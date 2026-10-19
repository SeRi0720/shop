import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrderService } from './order.service';

const MIN = 60_000;
const NOW = new Date('2026-10-14T03:00:00Z');

const VIEW = {
  id: 1,
  status: 'CANCELLED',
  totalAmount: 100_000,
  paymentMethod: 'VNPAY',
  shippingName: 'A',
  shippingPhone: '0900000000',
  shippingAddress: 'B',
  note: null,
  createdAt: NOW,
  items: [],
};

function setup() {
  const state = { inTx: false };
  const tx = {
    $queryRaw: jest.fn(),
    order: { update: jest.fn().mockResolvedValue({}) },
    orderItem: {
      findMany: jest.fn().mockResolvedValue([{ productId: 7, quantity: 2 }]),
    },
  };
  const prisma = {
    order: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => {
      state.inTx = true;
      try {
        return await cb(tx);
      } finally {
        state.inTx = false;
      }
    }),
  };
  const products = { increaseStock: jest.fn().mockResolvedValue(undefined) };
  const payments = {
    setStatus: jest.fn().mockResolvedValue(1),
    findByOrderId: jest
      .fn()
      .mockResolvedValue({ status: 'PENDING', amount: 1 }),
    findVnpayByOrderId: jest.fn(),
    findByTxnRef: jest.fn(),
  };
  const vnpay = {
    isConfigured: jest.fn().mockReturnValue(true),
    urlTtlMinutes: 15,
    queryTransaction: jest.fn(),
  };
  const service = new OrderService(
    prisma as never,
    {} as never,
    products as never,
    payments as never,
    vnpay as never,
  );
  const lock = (status: string, paymentMethod = 'VNPAY') =>
    tx.$queryRaw.mockResolvedValueOnce([{ id: 1, status, paymentMethod }]);
  const cancelled = () =>
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'CANCELLED' },
    });
  return {
    service,
    prisma,
    tx,
    products,
    payments,
    vnpay,
    state,
    lock,
    cancelled,
  };
}

describe('cancelExpiredVnpayOrders', () => {
  it('chưa cấu hình VNPay: không làm gì', async () => {
    const t = setup();
    t.vnpay.isConfigured.mockReturnValue(false);
    expect(await t.service.cancelExpiredVnpayOrders(NOW)).toEqual({
      checked: 0,
      paid: 0,
      cancelled: 0,
      skipped: 0,
    });
    expect(t.prisma.order.findMany).not.toHaveBeenCalled();
  });

  it('chỉ chọn đơn VNPAY PENDING tạo trước (hạn + 2 phút đệm), tối đa 20 đơn', async () => {
    const t = setup();
    t.prisma.order.findMany.mockResolvedValue([]);
    await t.service.cancelExpiredVnpayOrders(NOW);
    expect(t.prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          paymentMethod: 'VNPAY',
          status: 'PENDING',
          createdAt: { lt: new Date(NOW.getTime() - 17 * MIN) },
        },
        take: 20,
      }),
    );
  });

  it('VNPay báo đã thanh toán: đơn PAID, KHÔNG hủy', async () => {
    const t = setup();
    t.prisma.order.findMany.mockResolvedValue([{ id: 1 }]);
    jest.spyOn(t.service, 'syncVnpayPayment').mockResolvedValue('PAID');
    expect(await t.service.cancelExpiredVnpayOrders(NOW)).toMatchObject({
      checked: 1,
      paid: 1,
      cancelled: 0,
    });
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
    expect(t.products.increaseStock).not.toHaveBeenCalled();
  });

  it('VNPay xác nhận chưa có thanh toán: hủy, hoàn kho, payments FAILED', async () => {
    const t = setup();
    t.prisma.order.findMany.mockResolvedValue([{ id: 1 }]);
    jest.spyOn(t.service, 'syncVnpayPayment').mockResolvedValue('PENDING');
    t.lock('PENDING');
    expect(await t.service.cancelExpiredVnpayOrders(NOW)).toMatchObject({
      checked: 1,
      cancelled: 1,
    });
    expect(t.products.increaseStock).toHaveBeenCalledWith(t.tx, [
      { productId: 7, quantity: 2 },
    ]);
    t.cancelled();
    expect(t.payments.setStatus).toHaveBeenCalledWith(t.tx, 1, 'FAILED', [
      'PENDING_ON_DELIVERY',
      'PENDING',
    ]);
  });

  it('VNPay báo giao dịch thất bại (sync đã hủy): tính là đã hủy, không hủy lần hai', async () => {
    const t = setup();
    t.prisma.order.findMany.mockResolvedValue([{ id: 1 }]);
    jest.spyOn(t.service, 'syncVnpayPayment').mockResolvedValue('FAILED');
    expect(await t.service.cancelExpiredVnpayOrders(NOW)).toMatchObject({
      cancelled: 1,
    });
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('truy vấn lỗi: bỏ qua, KHÔNG hủy', async () => {
    const t = setup();
    t.prisma.order.findMany.mockResolvedValue([{ id: 1 }]);
    jest.spyOn(t.service, 'syncVnpayPayment').mockResolvedValue('ERROR');
    expect(await t.service.cancelExpiredVnpayOrders(NOW)).toMatchObject({
      skipped: 1,
      cancelled: 0,
    });
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('gọi VNPay NGOÀI transaction', async () => {
    const t = setup();
    t.prisma.order.findMany.mockResolvedValue([{ id: 1 }]);
    let inTxWhenQuerying: boolean | undefined;
    jest.spyOn(t.service, 'syncVnpayPayment').mockImplementation(async () => {
      inTxWhenQuerying = t.state.inTx;
      return 'PENDING';
    });
    t.lock('PENDING');
    await t.service.cancelExpiredVnpayOrders(NOW);
    expect(inTxWhenQuerying).toBe(false);
  });

  it('đơn đã PAID (IPN tới giữa chừng) hoặc đã CANCELLED khi khóa: để yên, hoàn kho tối đa một lần', async () => {
    const t = setup();
    t.prisma.order.findMany.mockResolvedValue([{ id: 1 }]);
    jest.spyOn(t.service, 'syncVnpayPayment').mockResolvedValue('PENDING');
    t.lock('PENDING'); // lượt 1 hủy
    t.lock('CANCELLED'); // lượt 2 thấy đã hủy
    await t.service.cancelExpiredVnpayOrders(NOW);
    const second = await t.service.cancelExpiredVnpayOrders(NOW);
    expect(second).toMatchObject({ cancelled: 0, skipped: 1 });
    expect(t.products.increaseStock).toHaveBeenCalledTimes(1);

    const u = setup();
    u.prisma.order.findMany.mockResolvedValue([{ id: 1 }]);
    jest.spyOn(u.service, 'syncVnpayPayment').mockResolvedValue('PENDING');
    u.lock('PAID');
    expect(await u.service.cancelExpiredVnpayOrders(NOW)).toMatchObject({
      skipped: 1,
    });
    expect(u.products.increaseStock).not.toHaveBeenCalled();
  });

  it('một đơn lỗi không chặn các đơn sau', async () => {
    const t = setup();
    t.prisma.order.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    jest
      .spyOn(t.service, 'syncVnpayPayment')
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('PAID');
    expect(await t.service.cancelExpiredVnpayOrders(NOW)).toEqual({
      checked: 2,
      paid: 1,
      cancelled: 0,
      skipped: 1,
    });
  });
});

describe('hủy thủ công đơn VNPay', () => {
  const ago = (m: number) => new Date(Date.now() - m * MIN);
  const peek = (paymentMethod: string, createdAt: Date) => ({
    status: 'PENDING',
    paymentMethod,
    createdAt,
  });

  it('đơn COD PENDING: hủy ngay, không hỏi VNPay', async () => {
    const t = setup();
    t.prisma.order.findFirst
      .mockResolvedValueOnce(peek('COD', ago(1)))
      .mockResolvedValueOnce({ ...VIEW, paymentMethod: 'COD' });
    const sync = jest.spyOn(t.service, 'syncVnpayPayment');
    t.lock('PENDING', 'COD');
    await t.service.cancel(5, 1);
    expect(sync).not.toHaveBeenCalled();
    t.cancelled();
  });

  it('đơn của người khác hoặc không có: 404', async () => {
    const t = setup();
    t.prisma.order.findFirst.mockResolvedValueOnce(null);
    await expect(t.service.cancel(5, 1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('URL còn hiệu lực: 409 kèm giờ hết hạn, không hỏi VNPay, không hủy', async () => {
    const t = setup();
    t.prisma.order.findFirst.mockResolvedValueOnce(peek('VNPAY', ago(5)));
    const sync = jest.spyOn(t.service, 'syncVnpayPayment');
    await expect(t.service.cancel(5, 1)).rejects.toThrow(
      /sẽ tự hủy sau \d{2}:\d{2}/,
    );
    expect(sync).not.toHaveBeenCalled();
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('hết hạn mà VNPay báo đã thanh toán: 409, không hủy', async () => {
    const t = setup();
    t.prisma.order.findFirst.mockResolvedValueOnce(peek('VNPAY', ago(16)));
    jest.spyOn(t.service, 'syncVnpayPayment').mockResolvedValue('PAID');
    await expect(t.service.cancel(5, 1)).rejects.toThrow(
      'Đơn đã thanh toán, không thể hủy',
    );
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('hết hạn mà không kiểm tra được (ERROR): 409, không hủy', async () => {
    const t = setup();
    t.prisma.order.findFirst.mockResolvedValueOnce(peek('VNPAY', ago(16)));
    jest.spyOn(t.service, 'syncVnpayPayment').mockResolvedValue('ERROR');
    await expect(t.service.cancel(5, 1)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('hết hạn, VNPay báo thất bại (sync đã hủy): trả đơn, không hủy lần hai', async () => {
    const t = setup();
    t.prisma.order.findFirst
      .mockResolvedValueOnce(peek('VNPAY', ago(16)))
      .mockResolvedValueOnce(VIEW);
    jest.spyOn(t.service, 'syncVnpayPayment').mockResolvedValue('FAILED');
    const view = await t.service.cancel(5, 1);
    expect(view.status).toBe('CANCELLED');
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('hết hạn, chưa thanh toán: được hủy, hoàn kho', async () => {
    const t = setup();
    t.prisma.order.findFirst
      .mockResolvedValueOnce(peek('VNPAY', ago(16)))
      .mockResolvedValueOnce(VIEW);
    jest.spyOn(t.service, 'syncVnpayPayment').mockResolvedValue('PENDING');
    t.lock('PENDING');
    await t.service.cancel(5, 1);
    t.cancelled();
    expect(t.products.increaseStock).toHaveBeenCalledTimes(1);
  });

  it('admin hủy đơn VNPay còn hạn: cùng điều kiện (409)', async () => {
    const t = setup();
    t.prisma.order.findUnique.mockResolvedValueOnce(peek('VNPAY', ago(5)));
    await expect(t.service.changeStatus(1, 'CANCELLED')).rejects.toThrow(
      /sẽ tự hủy sau/,
    );
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('admin chuyển SHIPPING không bị ràng buộc bởi hạn URL', async () => {
    const t = setup();
    t.prisma.order.findFirst.mockResolvedValueOnce({
      ...VIEW,
      status: 'SHIPPING',
      paymentMethod: 'COD',
    });
    t.lock('PENDING', 'COD');
    await t.service.changeStatus(1, 'SHIPPING');
    expect(t.prisma.order.findUnique).not.toHaveBeenCalled();
  });
});

describe('checkPayment', () => {
  it('người dùng: lọc theo userId; admin: không lọc theo userId', async () => {
    const t = setup();
    jest.spyOn(t.service, 'syncVnpayPayment').mockResolvedValue('PENDING');
    t.prisma.order.findFirst.mockResolvedValue({
      ...VIEW,
      status: 'PENDING',
      paymentMethod: 'VNPAY',
    });
    await t.service.checkPayment({ id: 5, role: 'USER' }, 1);
    expect(t.prisma.order.findFirst.mock.calls[0][0].where).toEqual({
      id: 1,
      userId: 5,
    });
    await t.service.checkPayment({ id: 9, role: 'ADMIN' }, 1);
    expect(t.prisma.order.findFirst.mock.calls[2][0].where).toEqual({ id: 1 });
  });

  it('đơn người khác: 404', async () => {
    const t = setup();
    t.prisma.order.findFirst.mockResolvedValueOnce(null);
    await expect(
      t.service.checkPayment({ id: 5, role: 'USER' }, 1),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    ['COD', 'PENDING'],
    ['VNPAY', 'PAID'],
    ['VNPAY', 'CANCELLED'],
  ])(
    'đơn %s ở trạng thái %s: 409, không hỏi VNPay',
    async (paymentMethod, status) => {
      const t = setup();
      const sync = jest.spyOn(t.service, 'syncVnpayPayment');
      t.prisma.order.findFirst.mockResolvedValueOnce({ status, paymentMethod });
      await expect(
        t.service.checkPayment({ id: 5, role: 'USER' }, 1),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(sync).not.toHaveBeenCalled();
    },
  );

  it('đơn VNPAY PENDING: hỏi VNPay rồi trả đơn hiện tại', async () => {
    const t = setup();
    const sync = jest
      .spyOn(t.service, 'syncVnpayPayment')
      .mockResolvedValue('PAID');
    t.prisma.order.findFirst
      .mockResolvedValueOnce({ status: 'PENDING', paymentMethod: 'VNPAY' })
      .mockResolvedValueOnce({ ...VIEW, status: 'PAID' });
    const view = await t.service.checkPayment({ id: 5, role: 'USER' }, 1);
    expect(sync).toHaveBeenCalledWith(1);
    expect(view.status).toBe('PAID');
  });
});

describe('syncVnpayPayment: giãn cách khi VNPay từ chối truy vấn lặp (mã 94)', () => {
  const PAYMENT = {
    txnRef: 'T1',
    amount: 100_000,
    status: 'PENDING',
    createdAt: NOW,
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  function prepare(queryResult: unknown) {
    const t = setup();
    t.payments.findVnpayByOrderId.mockResolvedValue(PAYMENT);
    t.payments.findByTxnRef.mockResolvedValue({ status: 'PENDING' });
    t.vnpay.queryTransaction.mockResolvedValue(queryResult);
    return t;
  }

  it('bị từ chối (rateLimited): trả ERROR, trong 5 phút không hỏi lại, sau đó hỏi lại', async () => {
    const t = prepare({
      kind: 'ERROR',
      reason: 'ResponseCode 94',
      rateLimited: true,
    });
    expect(await t.service.syncVnpayPayment(1)).toBe('ERROR');
    expect(await t.service.syncVnpayPayment(1)).toBe('ERROR');
    expect(t.vnpay.queryTransaction).toHaveBeenCalledTimes(1);

    jest.setSystemTime(new Date(NOW.getTime() + 5 * MIN + 1000));
    await t.service.syncVnpayPayment(1);
    expect(t.vnpay.queryTransaction).toHaveBeenCalledTimes(2);
  });

  it('lỗi thường (mạng, 5xx): lần sau vẫn hỏi lại ngay', async () => {
    const t = prepare({ kind: 'ERROR', reason: 'HTTP 500' });
    await t.service.syncVnpayPayment(1);
    await t.service.syncVnpayPayment(1);
    expect(t.vnpay.queryTransaction).toHaveBeenCalledTimes(2);
  });

  it('giãn cách chỉ áp cho đơn bị từ chối, không ảnh hưởng đơn khác', async () => {
    const t = prepare({
      kind: 'ERROR',
      reason: 'ResponseCode 94',
      rateLimited: true,
    });
    await t.service.syncVnpayPayment(1);
    await t.service.syncVnpayPayment(2);
    expect(t.vnpay.queryTransaction).toHaveBeenCalledTimes(2);
  });

  it('payments đã SUCCESS hoặc FAILED: trả luôn, không hỏi VNPay', async () => {
    const t = prepare({ kind: 'PAID' });
    t.payments.findVnpayByOrderId.mockResolvedValue({
      ...PAYMENT,
      status: 'SUCCESS',
    });
    expect(await t.service.syncVnpayPayment(1)).toBe('PAID');
    t.payments.findVnpayByOrderId.mockResolvedValue({
      ...PAYMENT,
      status: 'FAILED',
    });
    expect(await t.service.syncVnpayPayment(1)).toBe('FAILED');
    expect(t.vnpay.queryTransaction).not.toHaveBeenCalled();
  });
});
