import { OrderService } from './order.service';

const PAYLOAD = {
  vnp_Amount: '10000000', // 100.000 đồng x 100
  vnp_TransactionNo: '14000001',
  vnp_ResponseCode: '00',
  vnp_TransactionStatus: '00',
};
const PAY = {
  id: 9,
  orderId: 1,
  txnRef: 'T1',
  amount: 100_000,
  createdAt: new Date(),
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
    findByTxnRef: jest.fn(),
    finishVnpay: jest.fn().mockResolvedValue({ id: 9 }),
    setStatus: jest.fn().mockResolvedValue(1),
    findVnpayByOrderId: jest.fn(),
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
  /** Lần đọc đầu (ngoài tx) và lần đọc lại (trong tx) của payments. */
  const payment = (status: string, over: Record<string, unknown> = {}) => {
    const p = { ...PAY, status, ...over };
    payments.findByTxnRef.mockResolvedValueOnce(p).mockResolvedValueOnce(p);
  };
  const lock = (status: string) =>
    tx.$queryRaw.mockResolvedValueOnce([
      { id: 1, status, paymentMethod: 'VNPAY' },
    ]);
  return {
    service,
    prisma,
    tx,
    products,
    payments,
    vnpay,
    state,
    payment,
    lock,
  };
}

describe('applyVnpayResult (dùng chung cho IPN và queryDr)', () => {
  it('không thấy txnRef: NOT_FOUND, không mở transaction', async () => {
    const t = setup();
    t.payments.findByTxnRef.mockResolvedValueOnce(null);
    expect(await t.service.applyVnpayResult('X', true, PAYLOAD)).toBe(
      'NOT_FOUND',
    );
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('đơn biến mất giữa lúc đọc và lúc khóa: NOT_FOUND', async () => {
    const t = setup();
    t.payments.findByTxnRef.mockResolvedValueOnce(PAY);
    t.tx.$queryRaw.mockResolvedValueOnce([]);
    expect(await t.service.applyVnpayResult('T1', true, PAYLOAD)).toBe(
      'NOT_FOUND',
    );
    expect(t.payments.finishVnpay).not.toHaveBeenCalled();
  });

  it.each([['1'], ['abc'], [''], ['10000000.5'], ['9999999']])(
    'số tiền %j không khớp: AMOUNT_MISMATCH, không đổi gì',
    async (amount) => {
      const t = setup();
      t.payment('PENDING');
      t.lock('PENDING');
      const r = await t.service.applyVnpayResult('T1', true, {
        ...PAYLOAD,
        vnp_Amount: amount,
      });
      expect(r).toBe('AMOUNT_MISMATCH');
      expect(t.payments.finishVnpay).not.toHaveBeenCalled();
      expect(t.tx.order.update).not.toHaveBeenCalled();
    },
  );

  it('thiếu vnp_Amount: AMOUNT_MISMATCH', async () => {
    const t = setup();
    t.payment('PENDING');
    t.lock('PENDING');
    const { vnp_Amount, ...rest } = PAYLOAD;
    expect(await t.service.applyVnpayResult('T1', true, rest)).toBe(
      'AMOUNT_MISMATCH',
    );
  });

  it('thành công lần đầu: payments SUCCESS kèm providerTxnNo + rawPayload, đơn PAID', async () => {
    const t = setup();
    t.payment('PENDING');
    t.lock('PENDING');
    expect(await t.service.applyVnpayResult('T1', true, PAYLOAD)).toBe(
      'APPLIED_PAID',
    );
    expect(t.payments.finishVnpay).toHaveBeenCalledWith(t.tx, 9, 'SUCCESS', {
      providerTxnNo: '14000001',
      rawPayload: PAYLOAD,
    });
    expect(t.tx.order.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'PAID' },
    });
    expect(t.products.increaseStock).not.toHaveBeenCalled();
  });

  it('rawPayload không chứa vnp_SecureHash (kiểm tra ở biên controller, ở đây chỉ nhận đúng payload truyền vào)', async () => {
    const t = setup();
    t.payment('PENDING');
    t.lock('PENDING');
    await t.service.applyVnpayResult('T1', true, PAYLOAD);
    const info = t.payments.finishVnpay.mock.calls[0][3];
    expect(info.rawPayload).not.toHaveProperty('vnp_SecureHash');
  });

  it('thành công lần hai (payments đã SUCCESS): ALREADY_CONFIRMED, không ghi thêm', async () => {
    const t = setup();
    t.payment('SUCCESS');
    t.lock('PAID');
    expect(await t.service.applyVnpayResult('T1', true, PAYLOAD)).toBe(
      'ALREADY_CONFIRMED',
    );
    expect(t.payments.finishVnpay).not.toHaveBeenCalled();
    expect(t.tx.order.update).not.toHaveBeenCalled();
  });

  it('thất bại lần đầu: payments FAILED, đơn CANCELLED, hoàn đúng số lượng kho', async () => {
    const t = setup();
    t.payment('PENDING');
    t.lock('PENDING');
    const failed = {
      ...PAYLOAD,
      vnp_ResponseCode: '24',
      vnp_TransactionStatus: '02',
    };
    expect(await t.service.applyVnpayResult('T1', false, failed)).toBe(
      'APPLIED_FAILED',
    );
    expect(t.payments.finishVnpay).toHaveBeenCalledWith(
      t.tx,
      9,
      'FAILED',
      expect.any(Object),
    );
    expect(t.products.increaseStock).toHaveBeenCalledWith(t.tx, [
      { productId: 7, quantity: 2 },
    ]);
    expect(t.tx.order.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'CANCELLED' },
    });
  });

  it('thất bại lần hai (payments đã FAILED): ALREADY_CONFIRMED, không hoàn kho thêm', async () => {
    const t = setup();
    t.payment('FAILED');
    t.lock('CANCELLED');
    expect(await t.service.applyVnpayResult('T1', false, PAYLOAD)).toBe(
      'ALREADY_CONFIRMED',
    );
    expect(t.products.increaseStock).not.toHaveBeenCalled();
  });

  it('thất bại đến sau khi đơn đã PAID: không đụng gì (không hủy đơn đã trả tiền)', async () => {
    const t = setup();
    t.payment('SUCCESS');
    t.lock('PAID');
    expect(await t.service.applyVnpayResult('T1', false, PAYLOAD)).toBe(
      'ALREADY_CONFIRMED',
    );
    expect(t.tx.order.update).not.toHaveBeenCalled();
  });

  it('thất bại khi payments PENDING nhưng đơn đã CANCELLED (admin hủy): ghi FAILED, KHÔNG hoàn kho lần hai', async () => {
    const t = setup();
    t.payment('PENDING');
    t.lock('CANCELLED');
    expect(await t.service.applyVnpayResult('T1', false, PAYLOAD)).toBe(
      'APPLIED_FAILED',
    );
    expect(t.payments.finishVnpay).toHaveBeenCalledWith(
      t.tx,
      9,
      'FAILED',
      expect.any(Object),
    );
    expect(t.products.increaseStock).not.toHaveBeenCalled();
  });

  it('IPN thành công đến muộn (đơn đã CANCELLED, payments FAILED): LATE_PAID, payments SUCCESS, đơn giữ CANCELLED, không hoàn kho, có log cảnh báo', async () => {
    const t = setup();
    const warn = jest
      .spyOn(
        (t.service as never as { logger: { warn: () => void } }).logger,
        'warn',
      )
      .mockImplementation(() => undefined);
    t.payment('FAILED');
    t.lock('CANCELLED');
    expect(await t.service.applyVnpayResult('T1', true, PAYLOAD)).toBe(
      'LATE_PAID',
    );
    expect(t.payments.finishVnpay).toHaveBeenCalledWith(
      t.tx,
      9,
      'SUCCESS',
      expect.any(Object),
    );
    expect(t.tx.order.update).not.toHaveBeenCalled();
    expect(t.products.increaseStock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('khóa dòng đơn TRƯỚC khi đọc lại payments trong tx', async () => {
    const t = setup();
    const order: string[] = [];
    t.payments.findByTxnRef.mockImplementation(
      async (_ref: string, client?: unknown) => {
        order.push(client ? 'read-in-tx' : 'peek');
        return { ...PAY, status: 'PENDING' };
      },
    );
    t.tx.$queryRaw.mockImplementationOnce(async () => {
      order.push('lock');
      return [{ id: 1, status: 'PENDING', paymentMethod: 'VNPAY' }];
    });
    await t.service.applyVnpayResult('T1', true, PAYLOAD);
    expect(order).toEqual(['peek', 'lock', 'read-in-tx']);
  });
});

describe('syncVnpayPayment: các nhánh chính', () => {
  const PAYMENT = {
    txnRef: 'T1',
    amount: 100_000,
    status: 'PENDING',
    createdAt: new Date(),
  };

  function prepare(query: unknown, latest = 'PENDING') {
    const t = setup();
    t.payments.findVnpayByOrderId.mockResolvedValue(PAYMENT);
    t.payments.findByTxnRef.mockResolvedValue({ status: latest });
    t.vnpay.queryTransaction.mockResolvedValue(query);
    return t;
  }

  it('không có dòng payments VNPay (đơn COD): ERROR, không hỏi VNPay', async () => {
    const t = setup();
    t.payments.findVnpayByOrderId.mockResolvedValue(null);
    expect(await t.service.syncVnpayPayment(1)).toBe('ERROR');
    expect(t.vnpay.queryTransaction).not.toHaveBeenCalled();
  });

  it('hỏi VNPay với txnRef, amount và createdAt của dòng payments', async () => {
    const t = prepare({ kind: 'NOT_FOUND_OR_PENDING' });
    await t.service.syncVnpayPayment(1);
    expect(t.vnpay.queryTransaction).toHaveBeenCalledWith({
      txnRef: 'T1',
      amount: 100_000,
      transactionDate: PAYMENT.createdAt,
    });
  });

  it('PAID: gọi applyVnpayResult(success=true) với payload của queryDr, rồi trả PAID', async () => {
    const t = prepare({ kind: 'PAID', payload: PAYLOAD }, 'SUCCESS');
    const apply = jest
      .spyOn(t.service, 'applyVnpayResult')
      .mockResolvedValue('APPLIED_PAID');
    expect(await t.service.syncVnpayPayment(1)).toBe('PAID');
    expect(apply).toHaveBeenCalledWith('T1', true, PAYLOAD);
  });

  it('FAILED: gọi applyVnpayResult(success=false), trả FAILED', async () => {
    const t = prepare({ kind: 'FAILED', payload: PAYLOAD }, 'FAILED');
    const apply = jest
      .spyOn(t.service, 'applyVnpayResult')
      .mockResolvedValue('APPLIED_FAILED');
    expect(await t.service.syncVnpayPayment(1)).toBe('FAILED');
    expect(apply).toHaveBeenCalledWith('T1', false, PAYLOAD);
  });

  it.each([
    [{ kind: 'NOT_FOUND_OR_PENDING' }, 'PENDING'],
    [{ kind: 'ERROR', reason: 'HTTP 500' }, 'ERROR'],
  ])('%j: không đổi gì, trả %s', async (query, expected) => {
    const t = prepare(query);
    const apply = jest.spyOn(t.service, 'applyVnpayResult');
    expect(await t.service.syncVnpayPayment(1)).toBe(expected);
    expect(apply).not.toHaveBeenCalled();
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('IPN xử lý xong trong lúc chờ VNPay: đọc lại và trả trạng thái thật', async () => {
    const t = prepare({ kind: 'NOT_FOUND_OR_PENDING' }, 'SUCCESS');
    expect(await t.service.syncVnpayPayment(1)).toBe('PAID');
  });

  it('gọi VNPay NGOÀI transaction', async () => {
    const t = prepare({ kind: 'NOT_FOUND_OR_PENDING' });
    let inTx: boolean | undefined;
    t.vnpay.queryTransaction.mockImplementation(async () => {
      inTx = t.state.inTx;
      return { kind: 'NOT_FOUND_OR_PENDING' };
    });
    await t.service.syncVnpayPayment(1);
    expect(inTx).toBe(false);
  });
});
