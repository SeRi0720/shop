import type { PrismaClient } from '../src/generated/prisma/client';
import type { CreateOrderDto } from '../src/order/dto/create-order.dto';
import { CartService } from '../src/cart/cart.service';
import { OrderService } from '../src/order/order.service';
import { PaymentService } from '../src/payment/payment.service';
import { VnpayService } from '../src/payment/vnpay.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { ProductService } from '../src/product/product.service';
import {
  createProduct,
  createTestPrisma,
  createUser,
  fillCart,
  resetDatabase,
} from './helpers/test-db';

const ROUNDS = 10;
const ENV = {
  VNPAY_TMN_CODE: 'TESTTMN1',
  VNPAY_HASH_SECRET: 'TESTSECRETKEY1234567890ABCDEFGHIJ',
  VNPAY_RETURN_URL: 'http://localhost:5173/api/payments/vnpay/return',
};

describe('Tranh chấp xác nhận VNPay (PostgreSQL thật)', () => {
  let prisma: PrismaClient;
  let orders: OrderService;
  let payments: PaymentService;
  let vnpay: VnpayService;
  const saved: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const [k, v] of Object.entries(ENV)) {
      saved[k] = process.env[k];
      process.env[k] = v;
    }
    prisma = await createTestPrisma();
    const db = prisma as unknown as PrismaService;
    const products = new ProductService(db);
    payments = new PaymentService(db);
    vnpay = new VnpayService();
    orders = new OrderService(
      db,
      new CartService(db, products),
      products,
      payments,
      vnpay,
    );
  });

  afterAll(async () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await prisma.$disconnect();
  });

  afterEach(() => jest.restoreAllMocks());

  /** Đặt một đơn VNPAY thật (kho 5, mua 2 => kho còn 3). */
  async function placeVnpayOrder() {
    await resetDatabase(prisma);
    const product = await createProduct(prisma, { stock: 5 });
    const user = await createUser(prisma, 'vnpay');
    await fillCart(prisma, user.id, [{ productId: product.id, quantity: 2 }]);
    const dto: CreateOrderDto = {
      shippingName: 'Nguyen Test',
      shippingPhone: '0912345678',
      shippingAddress: '1 Test Street, Ha Noi',
      paymentMethod: 'VNPAY',
    };
    const order = await orders.create(user.id, dto, '::1');
    const payment = await prisma.payment.findFirstOrThrow({
      where: { orderId: order.id },
    });
    const payload = {
      vnp_Amount: String(payment.amount * 100),
      vnp_TransactionNo: '14000001',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TxnRef: payment.txnRef as string,
    };
    return { product, order, payment, payload };
  }

  const stockOf = async (id: number) =>
    (await prisma.product.findUniqueOrThrow({ where: { id } })).stock;
  const orderStatus = async (id: number) =>
    (await prisma.order.findUniqueOrThrow({ where: { id } })).status;
  const paymentStatus = async (orderId: number) =>
    (await prisma.payment.findFirstOrThrow({ where: { orderId } })).status;

  // (e), (e2), (f) ở các bước sau
  it('(e) hai IPN thành công song song: một APPLIED_PAID, một ALREADY_CONFIRMED, ghi một lần', async () => {
    for (let round = 1; round <= ROUNDS; round++) {
      const { order, payment, payload } = await placeVnpayOrder();
      const finish = jest.spyOn(payments, 'finishVnpay');

      const outcomes = await Promise.all([
        orders.applyVnpayResult(payment.txnRef as string, true, payload),
        orders.applyVnpayResult(payment.txnRef as string, true, payload),
      ]);

      expect([...outcomes].sort()).toEqual([
        'ALREADY_CONFIRMED',
        'APPLIED_PAID',
      ]);
      expect(finish).toHaveBeenCalledTimes(1); // chứng minh "một lần", không chỉ suy từ kết quả
      expect(await orderStatus(order.id)).toBe('PAID');
      expect(await paymentStatus(order.id)).toBe('SUCCESS');
      expect(await prisma.payment.count()).toBe(1);
      finish.mockRestore();
    }
  });

  it('(e2) IPN và syncVnpayPayment song song: đơn PAID, ghi payments một lần', async () => {
    for (let round = 1; round <= ROUNDS; round++) {
      const { order, payment, payload } = await placeVnpayOrder();
      jest.spyOn(vnpay, 'queryTransaction').mockResolvedValue({
        kind: 'PAID',
        transactionNo: '14000001',
        payload,
      });
      const finish = jest.spyOn(payments, 'finishVnpay');

      const [, state] = await Promise.all([
        orders.applyVnpayResult(payment.txnRef as string, true, payload),
        orders.syncVnpayPayment(order.id),
      ]);

      expect(state).toBe('PAID');
      expect(finish).toHaveBeenCalledTimes(1);
      expect(await orderStatus(order.id)).toBe('PAID');
      expect(await paymentStatus(order.id)).toBe('SUCCESS');
      expect(
        await stockOf(
          (
            await prisma.orderItem.findFirstOrThrow({
              where: { orderId: order.id },
            })
          ).productId,
        ),
      ).toBe(3);
      jest.restoreAllMocks();
    }
  });

  it('(f) IPN thành công và tự hủy quá hạn song song: luôn nhất quán, kho không hoàn đôi', async () => {
    const seen = { paid: 0, cancelled: 0 };
    for (let round = 1; round <= ROUNDS; round++) {
      const { order, product, payment, payload } = await placeVnpayOrder();
      jest
        .spyOn(vnpay, 'queryTransaction')
        .mockResolvedValue({ kind: 'NOT_FOUND_OR_PENDING' });

      const later = new Date(Date.now() + 60 * 60_000);
      const ipn = () =>
        orders.applyVnpayResult(payment.txnRef as string, true, payload);
      const expire = () => orders.cancelExpiredVnpayOrders(later);
      // Đổi thứ tự khởi chạy mỗi vòng để cả hai bên đều có cơ hội thắng
      await Promise.all(round % 2 ? [ipn(), expire()] : [expire(), ipn()]);

      const status = await orderStatus(order.id);
      const stock = await stockOf(product.id);
      // Chỉ hai kết cục hợp lệ; payments luôn SUCCESS vì tiền thật đã thu
      expect([
        { status: 'PAID', stock: 3 },
        { status: 'CANCELLED', stock: 5 },
      ]).toContainEqual({ status, stock });
      expect(await paymentStatus(order.id)).toBe('SUCCESS');
      if (status === 'PAID') seen.paid++;
      else seen.cancelled++;
      jest.restoreAllMocks();
    }
    console.log('(f) kết cục:', seen); // chỉ để quan sát, không assert
  });
});
