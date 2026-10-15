import { BadRequestException } from '@nestjs/common';
import { OrderService } from './order.service';

const T0 = new Date('2026-10-14T03:00:00Z');

const row = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  status: 'PENDING',
  totalAmount: 1000 * id,
  paymentMethod: 'COD',
  shippingName: 'A',
  shippingPhone: '0912345678',
  createdAt: T0,
  _count: { items: 2 },
  items: [{ productName: 'MacBook' }],
  ...over,
});

function setup(rows: unknown[] = [], total = rows.length) {
  const prisma = {
    order: {
      count: jest.fn().mockResolvedValue(total),
      findMany: jest.fn().mockResolvedValue(rows),
    },
    // Dạng mảng: các promise đã được tạo sẵn, chỉ cần chờ tất cả
    $transaction: jest.fn(async (arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : undefined,
    ),
  };
  const payments = {
    findLatestByOrderIds: jest
      .fn()
      .mockResolvedValue(new Map([[1, { status: 'SUCCESS', amount: 1000 }]])),
  };
  const vnpay = { urlTtlMinutes: 15 };
  const service = new OrderService(
    prisma as never,
    {} as never,
    {} as never,
    payments as never,
    vnpay as never,
  );
  return { service, prisma, payments };
}

describe('OrderService.listForUser', () => {
  it('chỉ lọc theo userId; count và findMany dùng chung where; phân trang và thứ tự đúng', async () => {
    const t = setup([row(1)], 25);
    const res = await t.service.listForUser(5, { page: 3, limit: 10 });
    const q = t.prisma.order.findMany.mock.calls[0][0];
    expect(q.where).toEqual({ userId: 5 });
    expect(t.prisma.order.count).toHaveBeenCalledWith({ where: { userId: 5 } });
    expect(q.skip).toBe(20);
    expect(q.take).toBe(10);
    expect(q.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(res).toMatchObject({ total: 25, page: 3, limit: 10, totalPages: 3 });
  });

  it('mặc định page=1, limit=10', async () => {
    const t = setup([]);
    await t.service.listForUser(5, {});
    const q = t.prisma.order.findMany.mock.calls[0][0];
    expect([q.skip, q.take]).toEqual([0, 10]);
  });

  it('mỗi dòng có itemCount, firstItemName, paymentStatus; KHÔNG lộ thông tin giao hàng', async () => {
    const t = setup([row(1), row(2, { items: [] })]);
    const { items } = await t.service.listForUser(5, {});
    expect(items[0]).toEqual({
      id: 1,
      createdAt: T0,
      status: 'PENDING',
      paymentMethod: 'COD',
      paymentStatus: 'SUCCESS',
      totalAmount: 1000,
      itemCount: 2,
      firstItemName: 'MacBook',
    });
    expect(items[1].paymentStatus).toBeNull(); // đơn không có dòng payments trong Map
    expect(items[1].firstItemName).toBeNull();
  });

  it('trạng thái thanh toán lấy bằng MỘT truy vấn cho cả trang (không N+1)', async () => {
    const t = setup([row(1), row(2), row(3)]);
    await t.service.listForUser(5, {});
    expect(t.payments.findLatestByOrderIds).toHaveBeenCalledTimes(1);
    expect(t.payments.findLatestByOrderIds).toHaveBeenCalledWith([1, 2, 3]);
  });
});

describe('OrderService.listForAdmin: dựng where', () => {
  const whereOf = async (query: Record<string, unknown>) => {
    const t = setup([]);
    await t.service.listForAdmin(query as never);
    return t.prisma.order.findMany.mock.calls[0][0].where;
  };

  it('không có bộ lọc: where chỉ gồm các giá trị undefined', async () => {
    const w = await whereOf({});
    expect(Object.values(w).every((v) => v === undefined)).toBe(true);
  });

  it('status và paymentMethod được chuyển nguyên', async () => {
    expect(
      await whereOf({ status: 'PAID', paymentMethod: 'VNPAY' }),
    ).toMatchObject({
      status: 'PAID',
      paymentMethod: 'VNPAY',
    });
  });

  it('from/to hiểu theo +07:00', async () => {
    const w = await whereOf({ from: '2026-10-01', to: '2026-10-14' });
    expect(w.createdAt.gte.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(w.createdAt.lte.toISOString()).toBe('2026-10-14T16:59:59.999Z');
  });

  it('chỉ có from thì không chặn trên', async () => {
    const w = await whereOf({ from: '2026-10-01' });
    expect(w.createdAt.lte).toBeUndefined();
  });

  it('from = to cùng một ngày được chấp nhận (biên)', async () => {
    await expect(
      whereOf({ from: '2026-10-14', to: '2026-10-14' }),
    ).resolves.toBeDefined();
  });

  it.each([
    [{ from: '2026-10-14', to: '2026-10-01' }],
    [{ from: '2026-02-31' }],
    [{ to: '2026-13-01' }],
  ])('%j bị từ chối 400, không truy vấn DB', async (query) => {
    const t = setup([]);
    await expect(t.service.listForAdmin(query as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(t.prisma.order.findMany).not.toHaveBeenCalled();
  });

  it('q chữ: khớp tên (không phân biệt hoa thường) hoặc số điện thoại; không có nhánh id', async () => {
    const w = await whereOf({ q: 'Nguyen' });
    expect(w.OR).toEqual([
      { shippingPhone: { contains: 'Nguyen' } },
      { shippingName: { contains: 'Nguyen', mode: 'insensitive' } },
    ]);
  });

  it('q chữ số: khớp mã đơn HOẶC số điện thoại', async () => {
    const w = await whereOf({ q: '912' });
    expect(w.OR).toEqual(
      expect.arrayContaining([
        { id: 912 },
        { shippingPhone: { contains: '912' } },
      ]),
    );
  });

  it('q chữ số vượt Int của Postgres: không có nhánh id (tránh lỗi tràn)', async () => {
    const w = await whereOf({ q: '99999999999999' });
    expect(w.OR.some((c: { id?: number }) => c.id !== undefined)).toBe(false);
  });

  it('q chứa % hoặc _ được escape', async () => {
    const w = await whereOf({ q: '50%_x' });
    expect(w.OR[1].shippingName.contains).toBe('50\\%\\_x');
  });
});

describe('nextStatuses (qua listForAdmin)', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(T0));
  afterEach(() => jest.useRealTimers());

  const nextOf = async (over: Record<string, unknown>) => {
    const t = setup([row(1, over)]);
    return (await t.service.listForAdmin({})).items[0].nextStatuses;
  };

  it('COD PENDING: SHIPPING, CANCELLED', async () => {
    expect(await nextOf({})).toEqual(['SHIPPING', 'CANCELLED']);
  });

  it('VNPAY PENDING còn hạn: ẩn CANCELLED', async () => {
    const created = new Date(T0.getTime() - 5 * 60_000); // 5 phút trước, TTL 15
    expect(
      await nextOf({ paymentMethod: 'VNPAY', createdAt: created }),
    ).not.toContain('CANCELLED');
  });

  it('VNPAY PENDING hết hạn: hiện CANCELLED', async () => {
    const created = new Date(T0.getTime() - 16 * 60_000);
    expect(
      await nextOf({ paymentMethod: 'VNPAY', createdAt: created }),
    ).toContain('CANCELLED');
  });

  it('trạng thái cuối không đi đâu', async () => {
    expect(await nextOf({ status: 'COMPLETED' })).toEqual([]);
    expect(await nextOf({ status: 'CANCELLED' })).toEqual([]);
  });
});
