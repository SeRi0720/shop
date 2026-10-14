import { ConflictException } from '@nestjs/common';
import { CartService } from '../src/cart/cart.service';
import type { PrismaClient } from '../src/generated/prisma/client';
import type { CreateOrderDto } from '../src/order/dto/create-order.dto';
import { OrderService } from '../src/order/order.service';
import { PaymentService } from '../src/payment/payment.service';
import { VnpayService, formatVnDate } from '../src/payment/vnpay.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { ProductService } from '../src/product/product.service';
import {
  createProduct,
  createTestPrisma,
  createUser,
  fillCart,
  getTestDatabaseUrl,
  resetDatabase,
} from './helpers/test-db';

const ROUNDS = 10; // lặp để các giao dịch có cơ hội chồng lên nhau thật

const dto: CreateOrderDto = {
  shippingName: 'Nguyen Test',
  shippingPhone: '0912345678',
  shippingAddress: '1 Test Street, Ha Noi',
  paymentMethod: 'COD',
};

const rejectedOf = (results: PromiseSettledResult<unknown>[]) =>
  results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
const fulfilledOf = (results: PromiseSettledResult<unknown>[]) =>
  results.filter((r) => r.status === 'fulfilled');

describe('Chốt chặn database test', () => {
  it('từ chối database có tên không chứa "test"', () => {
    const old = process.env.DATABASE_URL_TEST;
    process.env.DATABASE_URL_TEST = 'postgresql://u:p@localhost:5432/shop';
    try {
      expect(() => getTestDatabaseUrl()).toThrow(/không chứa "test"/);
    } finally {
      if (old === undefined) delete process.env.DATABASE_URL_TEST;
      else process.env.DATABASE_URL_TEST = old;
    }
  });
});

describe('Tranh chấp khi đặt và hủy đơn (PostgreSQL thật)', () => {
  let prisma: PrismaClient;
  let orders: OrderService;

  beforeAll(async () => {
    prisma = await createTestPrisma();
    const db = prisma as unknown as PrismaService;
    const products = new ProductService(db);
    const carts = new CartService(db, products);
    const payments = new PaymentService(db);
    // Bản thật (không mock): chỉ đọc process.env khi dùng, nên các ca COD không cần cấu hình.
    const vnpay = new VnpayService();
    orders = new OrderService(db, carts, products, payments, vnpay);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('(a) hai người mua chiếc cuối: đúng 1 đơn thành công, kho = 0', async () => {
    for (let round = 1; round <= ROUNDS; round++) {
      await resetDatabase(prisma);
      const product = await createProduct(prisma, { stock: 1 });
      const u1 = await createUser(prisma, 'a');
      const u2 = await createUser(prisma, 'b');
      await fillCart(prisma, u1.id, [{ productId: product.id, quantity: 1 }]);
      await fillCart(prisma, u2.id, [{ productId: product.id, quantity: 1 }]);

      const results = await Promise.allSettled([
        orders.create(u1.id, dto),
        orders.create(u2.id, dto),
      ]);

      const rejected = rejectedOf(results);
      expect(fulfilledOf(results)).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictException);
      // Người thua đi qua bước kiểm tra tồn kho SAU KHI khóa dòng => có danh sách items.
      // Nếu khóa mất, họ rơi xuống decreaseStock và không có `items`.
      expect(
        (rejected[0].reason as ConflictException).getResponse(),
      ).toMatchObject({
        items: [{ productId: product.id, requested: 1, available: 0 }],
      });

      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
          .stock,
      ).toBe(0);
      expect(await prisma.order.count()).toBe(1);
      expect(await prisma.payment.count()).toBe(1);

      const order = await prisma.order.findFirstOrThrow();
      const loserId = order.userId === u1.id ? u2.id : u1.id;
      expect(
        await prisma.cartItem.count({
          where: { cart: { userId: order.userId } },
        }),
      ).toBe(0); // giỏ người thắng rỗng
      expect(
        await prisma.cartItem.count({ where: { cart: { userId: loserId } } }),
      ).toBe(1); // giỏ người thua còn nguyên
    }
  });

  it('(b) một người đặt hai lần song song: đúng 1 đơn, kho chỉ trừ một lần', async () => {
    for (let round = 1; round <= ROUNDS; round++) {
      await resetDatabase(prisma);
      const product = await createProduct(prisma, { stock: 5 });
      const user = await createUser(prisma, 'solo');
      await fillCart(prisma, user.id, [{ productId: product.id, quantity: 1 }]);

      const results = await Promise.allSettled([
        orders.create(user.id, dto),
        orders.create(user.id, dto),
      ]);

      const rejected = rejectedOf(results);
      expect(fulfilledOf(results)).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictException);
      expect(
        (rejected[0].reason as ConflictException).getResponse(),
      ).toMatchObject({ message: 'Giỏ hàng trống hoặc đã được đặt' });

      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
          .stock,
      ).toBe(4);
      expect(await prisma.order.count()).toBe(1);
      expect(await prisma.payment.count()).toBe(1);
    }
  });

  it('(c) hủy cùng một đơn hai lần song song: kho chỉ hoàn một lần', async () => {
    for (let round = 1; round <= ROUNDS; round++) {
      await resetDatabase(prisma);
      const product = await createProduct(prisma, { stock: 3 });
      const user = await createUser(prisma, 'cancel');
      await fillCart(prisma, user.id, [{ productId: product.id, quantity: 2 }]);
      const placed = await orders.create(user.id, dto); // kho 3 -> 1

      const results = await Promise.allSettled([
        orders.cancel(user.id, placed.id),
        orders.cancel(user.id, placed.id),
      ]);

      const rejected = rejectedOf(results);
      expect(fulfilledOf(results)).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictException);

      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
          .stock,
      ).toBe(3); // hoàn đúng một lần (hoàn hai lần sẽ là 5)
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: placed.id } }))
          .status,
      ).toBe('CANCELLED');
      expect(
        (
          await prisma.payment.findFirstOrThrow({
            where: { orderId: placed.id },
          })
        ).status,
      ).toBe('FAILED');
    }
  });

  it('(d) đặt đơn VNPAY: payments PENDING có txnRef, kho trừ một lần, URL mang đúng txnRef và createdAt', async () => {
    const keys = ['VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET', 'VNPAY_RETURN_URL'];
    const saved = keys.map((k) => process.env[k]);
    process.env.VNPAY_TMN_CODE = 'TESTTMN1';
    process.env.VNPAY_HASH_SECRET = 'TESTSECRETKEY1234567890ABCDEFGHIJ';
    process.env.VNPAY_RETURN_URL =
      'http://localhost:5173/api/payments/vnpay/return';
    try {
      await resetDatabase(prisma);
      const product = await createProduct(prisma, { stock: 5 });
      const user = await createUser(prisma, 'vnpay');
      await fillCart(prisma, user.id, [{ productId: product.id, quantity: 2 }]);

      const placed = await orders.create(
        user.id,
        {
          shippingName: dto.shippingName,
          shippingPhone: dto.shippingPhone,
          shippingAddress: dto.shippingAddress,
          paymentMethod: 'VNPAY',
        },
        '::1',
      );

      const payment = await prisma.payment.findFirstOrThrow({
        where: { orderId: placed.id },
      });
      expect(payment.status).toBe('PENDING');
      expect(payment.txnRef).toMatch(/^\d{22}$/);
      const url = new URL(placed.paymentUrl as string);
      expect(url.searchParams.get('vnp_TxnRef')).toBe(payment.txnRef);
      expect(url.searchParams.get('vnp_CreateDate')).toBe(
        formatVnDate(payment.createdAt),
      );
      expect(url.searchParams.get('vnp_Amount')).toBe(
        String(payment.amount * 100),
      );
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
          .stock,
      ).toBe(3);
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: placed.id } }))
          .status,
      ).toBe('PENDING');
    } finally {
      keys.forEach((k, i) => {
        if (saved[i] === undefined) delete process.env[k];
        else process.env[k] = saved[i];
      });
    }
  });
});
