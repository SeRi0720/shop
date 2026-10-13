import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import {
  ORDER_STATUSES,
  canTransition,
  type OrderStatusValue,
  type PaymentMethodValue,
} from './order-state';
import { OrderService } from './order.service';

const dto = (over: Record<string, unknown> = {}) =>
  ({
    shippingName: 'Nguyễn Văn A',
    shippingPhone: '0912345678',
    shippingAddress: '1 Đại Cồ Việt, Hà Nội',
    paymentMethod: 'COD',
    ...over,
  }) as never;

function setup() {
  const calls: string[] = [];
  const rec = (name: string, result?: unknown) =>
    jest.fn().mockImplementation(() => {
      calls.push(name);
      return Promise.resolve(result);
    });

  // Mọi truy vấn model chỉ có trên tx
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]), // lockOrder (cancel / changeStatus)
    order: {
      create: rec('order.create', { id: 100 }),
      update: rec('order.update', {}),
    },
    orderItem: { findMany: rec('orderItem.findMany', []) },
  };

  let txOpen = false;
  const orderRow = {
    id: 100,
    status: 'PENDING',
    totalAmount: 2000,
    paymentMethod: 'COD',
    shippingName: 'Nguyễn Văn A',
    shippingPhone: '0912345678',
    shippingAddress: '1 Đại Cồ Việt, Hà Nội',
    note: null,
    createdAt: new Date(),
    items: [
      { productId: 5, productName: 'MacBook', unitPrice: 1000, quantity: 2 },
    ],
  };
  const prisma = {
    $transaction: jest
      .fn()
      .mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => {
        txOpen = true;
        try {
          return await fn(tx);
        } finally {
          txOpen = false;
        }
      }),
    // Chỉ đọc sau commit. Bị gọi lúc transaction đang mở = code dùng nhầm this.prisma.
    order: {
      findFirst: jest.fn().mockImplementation(() => {
        if (txOpen)
          throw new Error('this.prisma bị dùng bên trong transaction');
        return Promise.resolve(orderRow);
      }),
    },
  };

  const cart = {
    lockCart: rec('cart.lock', 1),
    readItems: rec('cart.read', [{ productId: 5, quantity: 2 }]),
    clear: rec('cart.clear'),
  };
  const products = {
    lockForUpdate: rec('product.lock', [
      { id: 5, name: 'MacBook', price: 1000, stock: 10, isActive: true },
    ]),
    decreaseStock: rec('product.decrease'),
    increaseStock: rec('product.increase'),
  };
  const payments = {
    createCod: rec('payment.createCod', { id: 1 }),
    setStatus: rec('payment.setStatus', 1),
    findByOrderId: jest
      .fn()
      .mockResolvedValue({ status: 'PENDING_ON_DELIVERY', amount: 2000 }),
  };

  const service = new OrderService(
    prisma as never,
    cart as never,
    products as never,
    payments as never,
  );
  return { service, calls, tx, prisma, cart, products, payments };
}

const lockedRow = (status: string, paymentMethod: string) => [
  { id: 100, status, paymentMethod },
];

describe('OrderService.create', () => {
  it('tạo đơn đúng: tên và giá lấy từ dòng đã khóa, tổng đúng, mọi bước qua cùng một tx', async () => {
    const s = setup();
    // price/totalAmount do client gửi phải bị bỏ qua
    await s.service.create(7, dto({ price: 1, totalAmount: 1 }));

    expect(s.tx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 7,
        totalAmount: 2000,
        paymentMethod: 'COD',
        note: null,
        items: {
          create: [
            {
              productId: 5,
              productName: 'MacBook',
              unitPrice: 1000,
              quantity: 2,
            },
          ],
        },
      }),
      select: { id: true },
    });
    expect(s.products.decreaseStock).toHaveBeenCalledWith(s.tx, [
      { productId: 5, quantity: 2 },
    ]);
    expect(s.payments.createCod).toHaveBeenCalledWith(s.tx, {
      orderId: 100,
      amount: 2000,
    });
    for (const fn of [
      s.cart.lockCart,
      s.cart.readItems,
      s.products.lockForUpdate,
      s.products.decreaseStock,
      s.payments.createCod,
      s.cart.clear,
    ]) {
      expect(fn.mock.calls[0][0]).toBe(s.tx);
    }
  });

  it('thứ tự gọi: khóa giỏ, đọc giỏ, khóa sản phẩm, rồi mới tạo đơn', async () => {
    const s = setup();
    await s.service.create(7, dto());
    expect(s.calls).toEqual([
      'cart.lock',
      'cart.read',
      'product.lock',
      'order.create',
      'product.decrease',
      'payment.createCod',
      'cart.clear',
    ]);
  });

  it('giỏ rỗng: 409, không khóa sản phẩm, không tạo đơn, không trừ kho', async () => {
    const s = setup();
    s.cart.readItems.mockResolvedValueOnce([]);
    await expect(s.service.create(7, dto())).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(s.products.lockForUpdate).not.toHaveBeenCalled();
    expect(s.tx.order.create).not.toHaveBeenCalled();
    expect(s.products.decreaseStock).not.toHaveBeenCalled();
  });

  it('thiếu hàng: 409 kèm danh sách dòng lỗi; không tạo đơn, không trừ kho, không xóa giỏ', async () => {
    const s = setup();
    s.products.lockForUpdate.mockResolvedValueOnce([
      { id: 5, name: 'MacBook', price: 1000, stock: 1, isActive: true },
    ]);
    const err = (await s.service
      .create(7, dto())
      .catch((e: unknown) => e)) as ConflictException;
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse()).toMatchObject({
      items: [{ productId: 5, name: 'MacBook', requested: 2, available: 1 }],
    });
    expect(s.tx.order.create).not.toHaveBeenCalled();
    expect(s.products.decreaseStock).not.toHaveBeenCalled();
    expect(s.cart.clear).not.toHaveBeenCalled();
  });

  it('sản phẩm đang ẩn hoặc không còn: available = 0', async () => {
    const s = setup();
    s.products.lockForUpdate.mockResolvedValueOnce([
      { id: 5, name: 'MacBook', price: 1000, stock: 10, isActive: false },
    ]);
    const hidden = (await s.service
      .create(7, dto())
      .catch((e: unknown) => e)) as ConflictException;
    expect(hidden.getResponse()).toMatchObject({
      items: [{ productId: 5, available: 0 }],
    });

    s.products.lockForUpdate.mockResolvedValueOnce([]);
    const gone = (await s.service
      .create(7, dto())
      .catch((e: unknown) => e)) as ConflictException;
    expect(gone.getResponse()).toMatchObject({
      items: [{ productId: 5, available: 0 }],
    });
  });

  it('đủ hàng đúng bằng số lượng thì được (biên)', async () => {
    const s = setup();
    s.products.lockForUpdate.mockResolvedValueOnce([
      { id: 5, name: 'MacBook', price: 1000, stock: 2, isActive: true },
    ]);
    await s.service.create(7, dto());
    expect(s.tx.order.create).toHaveBeenCalledTimes(1);
  });

  it('VNPAY: 400, không mở transaction', async () => {
    const s = setup();
    await expect(
      s.service.create(7, dto({ paymentMethod: 'VNPAY' })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(s.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('tổng vượt giới hạn Int: 400, không tạo đơn', async () => {
    const s = setup();
    s.products.lockForUpdate.mockResolvedValueOnce([
      {
        id: 5,
        name: 'MacBook',
        price: 2_000_000_000,
        stock: 10,
        isActive: true,
      },
    ]);
    await expect(s.service.create(7, dto())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(s.tx.order.create).not.toHaveBeenCalled();
  });
});

describe('OrderService.cancel', () => {
  it('đơn của người khác hoặc không tồn tại: 404, câu khóa lọc theo userId, không hoàn kho', async () => {
    const s = setup(); // $queryRaw mặc định trả []
    await expect(s.service.cancel(7, 100)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    // Tham số nội suy của câu SQL: [orderId, userId]
    expect(s.tx.$queryRaw.mock.calls[0].slice(1)).toEqual([100, 7]);
    expect(s.products.increaseStock).not.toHaveBeenCalled();
  });

  it('đơn đang SHIPPING: 409, không hoàn kho, không đổi gì', async () => {
    const s = setup();
    s.tx.$queryRaw.mockResolvedValueOnce(lockedRow('SHIPPING', 'COD'));
    await expect(s.service.cancel(7, 100)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(s.products.increaseStock).not.toHaveBeenCalled();
    expect(s.tx.order.update).not.toHaveBeenCalled();
  });

  it('hủy PENDING: hoàn đúng số lượng từng sản phẩm, CANCELLED, payments FAILED, cùng một tx', async () => {
    const s = setup();
    const items = [
      { productId: 5, quantity: 2 },
      { productId: 3, quantity: 1 },
    ];
    s.tx.$queryRaw.mockResolvedValueOnce(lockedRow('PENDING', 'COD'));
    s.tx.orderItem.findMany.mockResolvedValueOnce(items);

    await s.service.cancel(7, 100);

    expect(s.products.increaseStock).toHaveBeenCalledWith(s.tx, items);
    expect(s.tx.order.update).toHaveBeenCalledWith({
      where: { id: 100 },
      data: { status: 'CANCELLED' },
    });
    expect(s.payments.setStatus).toHaveBeenCalledWith(s.tx, 100, 'FAILED', [
      'PENDING_ON_DELIVERY',
      'PENDING',
    ]);
  });

  it('hủy lần hai: 409 và không hoàn kho thêm', async () => {
    const s = setup();
    s.tx.$queryRaw
      .mockResolvedValueOnce(lockedRow('PENDING', 'COD'))
      .mockResolvedValueOnce(lockedRow('CANCELLED', 'COD'));
    await s.service.cancel(7, 100);
    await expect(s.service.cancel(7, 100)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(s.products.increaseStock).toHaveBeenCalledTimes(1);
  });
});

describe('OrderService.changeStatus', () => {
  it('COD: SHIPPING sang COMPLETED thì payments thành SUCCESS', async () => {
    const s = setup();
    s.tx.$queryRaw.mockResolvedValueOnce(lockedRow('SHIPPING', 'COD'));
    await s.service.changeStatus(100, 'COMPLETED');
    expect(s.tx.order.update).toHaveBeenCalledWith({
      where: { id: 100 },
      data: { status: 'COMPLETED' },
    });
    expect(s.payments.setStatus).toHaveBeenCalledWith(s.tx, 100, 'SUCCESS', [
      'PENDING_ON_DELIVERY',
    ]);
  });

  it('VNPAY sang COMPLETED không đụng payments', async () => {
    const s = setup();
    s.tx.$queryRaw.mockResolvedValueOnce(lockedRow('SHIPPING', 'VNPAY'));
    await s.service.changeStatus(100, 'COMPLETED');
    expect(s.payments.setStatus).not.toHaveBeenCalled();
  });

  it('COD: PENDING sang SHIPPING chỉ đổi trạng thái đơn', async () => {
    const s = setup();
    s.tx.$queryRaw.mockResolvedValueOnce(lockedRow('PENDING', 'COD'));
    await s.service.changeStatus(100, 'SHIPPING');
    expect(s.tx.order.update).toHaveBeenCalledTimes(1);
    expect(s.payments.setStatus).not.toHaveBeenCalled();
    expect(s.products.increaseStock).not.toHaveBeenCalled();
  });

  it.each([
    ['PENDING', 'COMPLETED', 'COD'],
    ['COMPLETED', 'CANCELLED', 'COD'],
    ['CANCELLED', 'SHIPPING', 'COD'],
    ['SHIPPING', 'CANCELLED', 'COD'],
  ] as const)(
    'chuyển không hợp lệ %s → %s (%s): 409, không ghi gì',
    async (from, to, method) => {
      const s = setup();
      s.tx.$queryRaw.mockResolvedValueOnce(lockedRow(from, method));
      await expect(s.service.changeStatus(100, to)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(s.tx.order.update).not.toHaveBeenCalled();
      expect(s.products.increaseStock).not.toHaveBeenCalled();
    },
  );

  it('admin hủy đơn PAID (VNPAY): hoàn kho; payments chỉ đổi khi chưa thu tiền', async () => {
    const s = setup();
    s.tx.$queryRaw.mockResolvedValueOnce(lockedRow('PAID', 'VNPAY'));
    s.tx.orderItem.findMany.mockResolvedValueOnce([
      { productId: 5, quantity: 2 },
    ]);
    await s.service.changeStatus(100, 'CANCELLED');
    expect(s.products.increaseStock).toHaveBeenCalledTimes(1);
    expect(s.payments.setStatus).toHaveBeenCalledWith(s.tx, 100, 'FAILED', [
      'PENDING_ON_DELIVERY',
      'PENDING',
    ]);
  });

  it('đơn không tồn tại: 404; câu khóa không lọc userId', async () => {
    const s = setup();
    await expect(
      s.service.changeStatus(100, 'SHIPPING'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(s.tx.$queryRaw.mock.calls[0].slice(1)).toEqual([100]);
  });
});

describe('canTransition (theo bảng)', () => {
  const key = (f: string, t: string, m: string) => `${f}>${t}:${m}`;
  const VALID = new Set([
    key('PENDING', 'SHIPPING', 'COD'),
    key('PENDING', 'PAID', 'VNPAY'),
    key('PENDING', 'CANCELLED', 'COD'),
    key('PENDING', 'CANCELLED', 'VNPAY'),
    key('PAID', 'SHIPPING', 'VNPAY'),
    key('PAID', 'CANCELLED', 'VNPAY'),
    key('SHIPPING', 'COMPLETED', 'COD'),
    key('SHIPPING', 'COMPLETED', 'VNPAY'),
  ]);
  const methods: PaymentMethodValue[] = ['COD', 'VNPAY'];
  const all = ORDER_STATUSES.flatMap((f) =>
    ORDER_STATUSES.flatMap((t) =>
      methods.map(
        (m) =>
          [f, t, m] as [OrderStatusValue, OrderStatusValue, PaymentMethodValue],
      ),
    ),
  );

  it.each(all)('%s → %s (%s)', (from, to, method) => {
    expect(canTransition(from, to, method)).toBe(
      VALID.has(key(from, to, method)),
    );
  });

  it('các quy tắc nêu tên: COD không sang PAID, VNPAY không sang SHIPPING từ PENDING, trạng thái cuối không đi đâu', () => {
    expect(canTransition('PENDING', 'PAID', 'COD')).toBe(false);
    expect(canTransition('PENDING', 'SHIPPING', 'VNPAY')).toBe(false);
    for (const to of ORDER_STATUSES) {
      for (const m of methods) {
        expect(canTransition('COMPLETED', to, m)).toBe(false);
        expect(canTransition('CANCELLED', to, m)).toBe(false);
      }
    }
  });
});

describe('CreateOrderDto / UpdateOrderStatusDto', () => {
  const errorProps = async (plain: object) =>
    (await validate(plainToInstance(CreateOrderDto, plain))).map(
      (e) => e.property,
    );
  const base = { ...(dto() as object) };

  it('hợp lệ (kể cả số điện thoại +84 và ghi chú đúng 500 ký tự)', async () => {
    expect(await errorProps(base)).toEqual([]);
    expect(
      await errorProps({ ...base, shippingPhone: '+84912345678' }),
    ).toEqual([]);
    expect(await errorProps({ ...base, note: 'a'.repeat(500) })).toEqual([]);
  });

  it.each(['123', '09123456789', 'abcdefghij', ''])(
    'số điện thoại %p bị từ chối',
    async (p) => {
      expect(await errorProps({ ...base, shippingPhone: p })).toContain(
        'shippingPhone',
      );
    },
  );

  it('tên rỗng hoặc chỉ khoảng trắng, địa chỉ quá ngắn, ghi chú 501 ký tự, phương thức lạ bị từ chối', async () => {
    expect(await errorProps({ ...base, shippingName: '   ' })).toContain(
      'shippingName',
    );
    expect(await errorProps({ ...base, shippingAddress: 'abc' })).toContain(
      'shippingAddress',
    );
    expect(await errorProps({ ...base, note: 'a'.repeat(501) })).toContain(
      'note',
    );
    expect(await errorProps({ ...base, paymentMethod: 'CASH' })).toContain(
      'paymentMethod',
    );
  });

  it('price và totalAmount do client gửi bị whitelist loại bỏ', async () => {
    const inst = plainToInstance(CreateOrderDto, {
      ...base,
      price: 1,
      totalAmount: 1,
    });
    await validate(inst, { whitelist: true });
    expect(inst).not.toHaveProperty('price');
    expect(inst).not.toHaveProperty('totalAmount');
  });

  it('UpdateOrderStatusDto chỉ nhận SHIPPING, COMPLETED, CANCELLED', async () => {
    const bad = async (status: unknown) =>
      (await validate(plainToInstance(UpdateOrderStatusDto, { status })))
        .length > 0;
    expect(await bad('SHIPPING')).toBe(false);
    expect(await bad('COMPLETED')).toBe(false);
    expect(await bad('CANCELLED')).toBe(false);
    expect(await bad('PAID')).toBe(true);
    expect(await bad('PENDING')).toBe(true);
    expect(await bad(undefined)).toBe(true);
  });
});
