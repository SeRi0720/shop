import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest'; // nếu báo lỗi default import: import * as request from 'supertest'
import { JwtAuthGuard } from '../src/common/auth/jwt-auth.guard';
import { RolesGuard } from '../src/common/auth/roles.guard';
import type { PrismaClient } from '../src/generated/prisma/client';
import type { OrderStatusValue } from '../src/order/order-state';
import { PrismaService } from '../src/prisma/prisma.service';
import { resolveRange } from '../src/stats/stats-range';
import { StatsController } from '../src/stats/stats.controller';
import { StatsService } from '../src/stats/stats.service';
import { UserService } from '../src/user/user.service';
import { createTestPrisma, resetDatabase } from './helpers/test-db';

const MARK = '[stats-test]';
const MAIL = '@test.local';
type PayStatus = 'PENDING' | 'PENDING_ON_DELIVERY' | 'SUCCESS' | 'FAILED';

interface OrderSpec {
  status: OrderStatusValue;
  method?: 'COD' | 'VNPAY';
  total: number;
  createdAt: string;
  payments?: PayStatus[];
  items?: {
    productId: number;
    name: string;
    unitPrice: number;
    quantity: number;
  }[];
}

describe('Thống kê (PostgreSQL thật)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let stats: StatsService;
  let categoryId: number;
  let brandId: number;

  const noon = (day: string) => `${day}T05:00:00.000Z`; // 12:00 giờ VN
  const get = (path: string, query: Record<string, string> = {}) =>
    request(app.getHttpServer()).get(`/api/admin/stats/${path}`).query(query);

  const newUser = (role: 'USER' | 'ADMIN', tag: string, createdAt: string) =>
    prisma.user.create({
      data: {
        email: `${tag}${MAIL}`,
        passwordHash: 'x',
        fullName: `${MARK} ${tag}`,
        role,
        createdAt: new Date(createdAt),
      },
    });

  const newProduct = (name: string, price: number) =>
    prisma.product.create({
      data: { name: `${MARK} ${name}`, price, categoryId, brandId },
    });

  const newOrder = (userId: number, s: OrderSpec) =>
    prisma.order.create({
      data: {
        userId,
        status: s.status,
        paymentMethod: s.method ?? 'COD',
        totalAmount: s.total,
        shippingName: `${MARK} order`,
        shippingPhone: '0900000000',
        shippingAddress: 'x',
        createdAt: new Date(s.createdAt),
        payments: s.payments
          ? {
              create: s.payments.map((status) => ({ amount: s.total, status })),
            }
          : undefined,
        items: s.items
          ? {
              create: s.items.map((i) => ({
                productId: i.productId,
                productName: i.name,
                unitPrice: i.unitPrice,
                quantity: i.quantity,
              })),
            }
          : undefined,
      },
    });

  beforeAll(async () => {
    prisma = await createTestPrisma(); // đã qua chốt chặn DATABASE_URL_TEST
    const db = prisma as unknown as PrismaService;
    const mod = await Test.createTestingModule({
      controllers: [StatsController],
      providers: [
        StatsService,
        UserService,
        { provide: PrismaService, useValue: db },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    stats = app.get(StatsService);

    await resetDatabase(prisma);
    categoryId = (await prisma.category.create({ data: { name: 'stats-cat' } }))
      .id;
    brandId = (await prisma.brand.create({ data: { name: 'stats-brand' } })).id;
  });

  afterAll(async () => {
    if (prisma) await resetDatabase(prisma);
    await app?.close();
    await prisma?.$disconnect();
  });

  // ---------------------------------------------------------------- (l)
  describe('(l) quy tắc doanh thu', () => {
    const D = '2031-03-10';
    beforeAll(async () => {
      const c = await newUser('USER', 'l-cust', '2031-01-01T00:00:00Z');
      const at = noon(D);
      // Hai dòng payment SUCCESS trên một đơn: EXISTS không được nhân đôi
      await newOrder(c.id, {
        status: 'PAID',
        method: 'VNPAY',
        total: 1_000_000,
        createdAt: at,
        payments: ['SUCCESS', 'SUCCESS'],
      });
      await newOrder(c.id, {
        status: 'COMPLETED',
        method: 'VNPAY',
        total: 2_000_000,
        createdAt: at,
        payments: ['SUCCESS'],
      });
      await newOrder(c.id, {
        status: 'COMPLETED',
        method: 'COD',
        total: 3_000_000,
        createdAt: at,
        payments: ['SUCCESS'],
      });
      await newOrder(c.id, {
        status: 'SHIPPING',
        method: 'COD',
        total: 4_000_000,
        createdAt: at,
        payments: ['PENDING_ON_DELIVERY'],
      });
      await newOrder(c.id, {
        status: 'CANCELLED',
        method: 'VNPAY',
        total: 5_000_000,
        createdAt: at,
        payments: ['SUCCESS'],
      }); // hủy nhưng đã thu tiền
      await newOrder(c.id, {
        status: 'PENDING',
        method: 'VNPAY',
        total: 6_000_000,
        createdAt: at,
        payments: ['PENDING'],
      });
      // Tổng vượt 2^31 ở ngày kế tiếp (mỗi đơn vẫn nằm trong int4)
      const big = noon('2031-03-11');
      await newOrder(c.id, {
        status: 'COMPLETED',
        total: 2_000_000_000,
        createdAt: big,
        payments: ['SUCCESS'],
      });
      await newOrder(c.id, {
        status: 'COMPLETED',
        total: 2_000_000_000,
        createdAt: big,
        payments: ['SUCCESS'],
      });
    });

    it('chỉ ba đơn đầu được tính; đơn hủy đã thu tiền và đơn COD đang giao thì không', async () => {
      const r = resolveRange({ from: D, to: D });
      expect(await stats.summary(r)).toMatchObject({
        revenue: 6_000_000,
        revenueOrderCount: 3,
        orderCount: 6,
      });
      expect((await stats.revenue(r)).items).toEqual([
        { key: D, revenue: 6_000_000, orderCount: 3 },
      ]);
    });

    it('tổng vượt 2^31: service và HTTP đều đúng, không lỗi 500', async () => {
      const r = resolveRange({ from: '2031-03-11', to: '2031-03-11' });
      expect((await stats.summary(r)).revenue).toBe(4_000_000_000);

      const s = await get('summary', {
        from: '2031-03-11',
        to: '2031-03-11',
      }).expect(200);
      expect((s.body as { revenue: number }).revenue).toBe(4_000_000_000);

      const rev = await get('revenue', { from: D, to: '2031-03-11' }).expect(
        200,
      );
      expect((rev.body as { items: unknown[] }).items).toEqual([
        { key: D, revenue: 6_000_000, orderCount: 3 },
        { key: '2031-03-11', revenue: 4_000_000_000, orderCount: 2 },
      ]);
    });

    it('tham số sai: 400', async () => {
      await get('summary', { from: '2031-02-31' }).expect(400);
      await get('summary', { from: '2031-03-10', to: '2031-03-01' }).expect(
        400,
      );
      await get('revenue', { granularity: 'week' }).expect(400);
      await get('top-products', { limit: '11' }).expect(400);
    });
  });

  // ---------------------------------------------------------------- (m)
  describe('(m) biên múi giờ', () => {
    beforeAll(async () => {
      const c = await newUser('USER', 'm-cust', '2031-01-01T00:00:00Z');
      const done = (total: number, createdAt: string) =>
        newOrder(c.id, {
          status: 'COMPLETED',
          total,
          createdAt,
          payments: ['SUCCESS'],
        });
      await done(1000, '2031-04-10T16:59:59.999Z'); // 23:59:59.999 ngày 10/4 giờ VN
      await done(2000, '2031-04-10T17:00:00.000Z'); // 00:00:00.000 ngày 11/4 giờ VN
      await done(3000, '2031-04-30T16:59:59.999Z'); // 30/4 giờ VN
      await done(4000, '2031-04-30T17:00:00.000Z'); // 01/5 giờ VN
    });

    it('23:59 và 00:00 giờ VN rơi vào hai ngày khác nhau', async () => {
      const r = await stats.revenue(
        resolveRange({ from: '2031-04-10', to: '2031-04-11' }),
      );
      expect(r.items).toEqual([
        { key: '2031-04-10', revenue: 1000, orderCount: 1 },
        { key: '2031-04-11', revenue: 2000, orderCount: 1 },
      ]);
    });

    it('biên tháng: hai đơn ở 30/4 và 01/5 giờ VN thuộc hai tháng', async () => {
      const r = await stats.revenue(
        resolveRange({
          from: '2031-04-01',
          to: '2031-05-31',
          granularity: 'month',
        }),
      );
      expect(r.items).toEqual([
        { key: '2031-04', revenue: 6000, orderCount: 3 },
        { key: '2031-05', revenue: 4000, orderCount: 1 },
      ]);
    });

    it('lọc from/to bao trọn đúng hai đầu', async () => {
      const first = await stats.summary(
        resolveRange({ from: '2031-04-10', to: '2031-04-10' }),
      );
      const second = await stats.summary(
        resolveRange({ from: '2031-04-11', to: '2031-04-11' }),
      );
      expect(first.revenue).toBe(1000);
      expect(second.revenue).toBe(2000);
    });
  });

  // ---------------------------------------------------------------- (n)
  describe('(n) top sản phẩm', () => {
    const D = '2031-06-10';
    const ids: Record<string, number> = {};

    beforeAll(async () => {
      const c = await newUser('USER', 'n-cust', '2031-01-01T00:00:00Z');
      for (const [k, price] of [
        ['p1', 1_000_000],
        ['p2', 2_000_000],
        ['p3', 2_000_000],
        ['p4', 100],
        ['p5', 2_000_000_000],
      ] as const) {
        ids[k] = (await newProduct(k, price)).id; // tạo lần lượt nên id tăng dần p1 < p2 < p3
      }
      const at = noon(D);
      await newOrder(c.id, {
        status: 'COMPLETED',
        total: 1,
        createdAt: at,
        payments: ['SUCCESS'],
        items: [
          {
            productId: ids.p1,
            name: 'P1 cũ',
            unitPrice: 1_000_000,
            quantity: 1,
          },
          { productId: ids.p2, name: 'P2', unitPrice: 2_000_000, quantity: 3 },
        ],
      });
      await newOrder(c.id, {
        status: 'PAID',
        method: 'VNPAY',
        total: 1,
        createdAt: at,
        payments: ['SUCCESS'],
        items: [
          { productId: ids.p3, name: 'P3', unitPrice: 2_000_000, quantity: 3 },
          {
            productId: ids.p1,
            name: 'P1 mới',
            unitPrice: 1_000_000,
            quantity: 2,
          }, // tên mới hơn của P1
        ],
      });
      await newOrder(c.id, {
        status: 'COMPLETED',
        total: 1,
        createdAt: at,
        payments: ['SUCCESS'],
        items: [
          { productId: ids.p4, name: 'P4 tên cũ', unitPrice: 100, quantity: 5 },
        ],
      });
      await newOrder(c.id, {
        status: 'COMPLETED',
        total: 1,
        createdAt: at,
        payments: ['SUCCESS'],
        items: [
          {
            productId: ids.p5,
            name: 'P5',
            unitPrice: 2_000_000_000,
            quantity: 10,
          }, // 2e10: nhân int4 sẽ tràn
        ],
      });
      // Hai đơn KHÔNG tính doanh thu, không được đóng góp
      await newOrder(c.id, {
        status: 'CANCELLED',
        method: 'VNPAY',
        total: 1,
        createdAt: at,
        payments: ['SUCCESS'],
        items: [
          {
            productId: ids.p1,
            name: 'P1 mới',
            unitPrice: 1_000_000,
            quantity: 100,
          },
        ],
      });
      await newOrder(c.id, {
        status: 'SHIPPING',
        total: 1,
        createdAt: at,
        payments: ['PENDING_ON_DELIVERY'],
        items: [
          { productId: ids.p2, name: 'P2', unitPrice: 2_000_000, quantity: 50 },
        ],
      });
      // Sản phẩm bị ẩn và đổi tên sau khi bán
      await prisma.product.update({
        where: { id: ids.p4 },
        data: { isActive: false, name: `${MARK} p4 tên mới` },
      });
    });

    it('sắp theo số lượng, rồi doanh thu, rồi product_id; tên lấy từ order_items mới nhất', async () => {
      const { items } = await stats.topProducts(
        resolveRange({ from: D, to: D }),
        10,
      );
      expect(items).toEqual([
        {
          productId: ids.p5,
          name: 'P5',
          quantity: 10,
          revenue: 20_000_000_000,
        },
        { productId: ids.p4, name: 'P4 tên cũ', quantity: 5, revenue: 500 },
        { productId: ids.p2, name: 'P2', quantity: 3, revenue: 6_000_000 },
        { productId: ids.p3, name: 'P3', quantity: 3, revenue: 6_000_000 }, // hòa p2 -> product_id nhỏ trước
        { productId: ids.p1, name: 'P1 mới', quantity: 3, revenue: 3_000_000 },
      ]);
    });

    it('limit cắt đúng, HTTP trả số lớn không lỗi', async () => {
      const res = await get('top-products', {
        from: D,
        to: D,
        limit: '2',
      }).expect(200);
      const items = (
        res.body as { items: { productId: number; revenue: number }[] }
      ).items;
      expect(items.map((i) => i.productId)).toEqual([ids.p5, ids.p4]);
      expect(items[0].revenue).toBe(20_000_000_000);
    });
  });

  // ---------------------------------------------------------------- (o)
  describe('(o) order-status và summary', () => {
    const D = '2031-07-10';
    const EMPTY = { from: '2032-01-01', to: '2032-01-02' };

    beforeAll(async () => {
      const c = await newUser('USER', 'o-cust', '2031-01-01T00:00:00Z');
      await newUser('USER', 'o-new1', '2031-07-10T05:00:00Z');
      await newUser('USER', 'o-new2', '2031-07-10T06:00:00Z');
      await newUser('ADMIN', 'o-admin', '2031-07-10T07:00:00Z'); // không được tính vào người dùng mới
      const at = noon(D);
      await newOrder(c.id, {
        status: 'PENDING',
        method: 'VNPAY',
        total: 100,
        createdAt: at,
        payments: ['PENDING'],
      });
      await newOrder(c.id, {
        status: 'PENDING',
        method: 'VNPAY',
        total: 100,
        createdAt: at,
        payments: ['PENDING'],
      });
      await newOrder(c.id, {
        status: 'PAID',
        method: 'VNPAY',
        total: 200,
        createdAt: at,
        payments: ['SUCCESS'],
      });
      await newOrder(c.id, {
        status: 'COMPLETED',
        total: 300,
        createdAt: at,
        payments: ['SUCCESS'],
      });
      await newOrder(c.id, {
        status: 'CANCELLED',
        method: 'VNPAY',
        total: 400,
        createdAt: at,
        payments: ['FAILED'],
      });
      // Ngoài kỳ: không được đếm vào đơn theo trạng thái
      await newOrder(c.id, {
        status: 'SHIPPING',
        total: 500,
        createdAt: noon('2031-08-01'),
        payments: ['PENDING_ON_DELIVERY'],
      });
    });

    it('order-status luôn đủ năm trạng thái theo thứ tự, chỉ đếm đơn trong kỳ', async () => {
      const r = await stats.orderStatus(resolveRange({ from: D, to: D }));
      expect(r.items).toEqual([
        { status: 'PENDING', count: 2 },
        { status: 'PAID', count: 1 },
        { status: 'SHIPPING', count: 0 },
        { status: 'COMPLETED', count: 1 },
        { status: 'CANCELLED', count: 1 },
      ]);
    });

    it('kỳ không có đơn: vẫn đủ năm dòng bằng 0', async () => {
      const r = await stats.orderStatus(resolveRange(EMPTY));
      expect(r.items.map((i) => i.status)).toEqual([
        'PENDING',
        'PAID',
        'SHIPPING',
        'COMPLETED',
        'CANCELLED',
      ]);
      expect(r.items.every((i) => i.count === 0)).toBe(true);
    });

    it('summary: orderCount mọi trạng thái, newUserCount không tính ADMIN, pending không theo kỳ', async () => {
      const s = await stats.summary(resolveRange({ from: D, to: D }));
      expect(s).toMatchObject({
        orderCount: 5,
        revenueOrderCount: 2,
        revenue: 500,
        newUserCount: 2,
      });

      const empty = await stats.summary(resolveRange(EMPTY));
      expect(empty).toMatchObject({
        orderCount: 0,
        revenue: 0,
        revenueOrderCount: 0,
        newUserCount: 0,
      });
      expect(s.pendingOrderCount).toBe(empty.pendingOrderCount);
      expect(empty.pendingOrderCount).toBeGreaterThanOrEqual(2);
    });
  });
});
