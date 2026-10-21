import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { ORDER_STATUSES } from '../order/order-state';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { fillBuckets } from './stats-buckets';
import { numberifyRow } from './stats-numbers';
import type { Granularity, ResolvedRange } from './stats-range';
import type {
  OrderStatusResult,
  RevenueResult,
  StatsSummary,
  TopProductItem,
} from './stats.types';

// created_at là `timestamp` (không múi giờ) lưu UTC. Nếu DB báo `timestamptz` (kết quả ngày 1):
//   VN_LOCAL  -> (o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
//   BOUND_TYPE -> 'timestamptz'
const VN_LOCAL = Prisma.sql`((o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')`;
const BOUND_TYPE = Prisma.raw('timestamp');

/** Quy tắc doanh thu (quyết định 8): trạng thái đơn VÀ có payment SUCCESS. EXISTS để nhiều dòng payment không nhân đôi. */
const REVENUE_ORDER = Prisma.sql`o.status IN ('PAID', 'SHIPPING', 'COMPLETED')
  AND EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.status = 'SUCCESS')`;

/** Biên truyền bằng chuỗi ISO ép kiểu: "Z" bị bỏ, giữ nguyên giá trị UTC, không phụ thuộc múi giờ phiên. */
const inRange = (r: ResolvedRange) => Prisma.sql`
  o.created_at >= ${r.from.toISOString()}::${BOUND_TYPE}
  AND o.created_at <= ${r.to.toISOString()}::${BOUND_TYPE}`;

const bucketKey = (g: Granularity) =>
  Prisma.sql`to_char(${VN_LOCAL}, ${Prisma.raw(g === 'day' ? "'YYYY-MM-DD'" : "'YYYY-MM'")})`;

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UserService,
  ) {}

  async revenue(range: ResolvedRange): Promise<RevenueResult> {
    const rows = await this.prisma.$queryRaw<
      { key: string; revenue: bigint; orderCount: number }[]
    >(Prisma.sql`
      SELECT ${bucketKey(range.granularity)} AS "key",
             COALESCE(SUM(o.total_amount), 0)::bigint AS revenue,
             COUNT(*)::int AS "orderCount"
      FROM orders o
      WHERE ${REVENUE_ORDER} AND ${inRange(range)}
      GROUP BY 1
      ORDER BY 1`);
    const items = fillBuckets(
      rows.map((r) => numberifyRow(r)),
      range.fromDay,
      range.toDay,
      range.granularity,
    );
    return { granularity: range.granularity, items };
  }

  async summary(range: ResolvedRange): Promise<StatsSummary> {
    const [rev, all, pending, newUserCount] = await Promise.all([
      this.prisma.$queryRaw<{ revenue: bigint; count: number }[]>(Prisma.sql`
        SELECT COALESCE(SUM(o.total_amount), 0)::bigint AS revenue, COUNT(*)::int AS "count"
        FROM orders o
        WHERE ${REVENUE_ORDER} AND ${inRange(range)}`),
      this.prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS "count" FROM orders o WHERE ${inRange(range)}`),
      this.prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS "count" FROM orders WHERE status = 'PENDING'`),
      this.users.countNewUsers(range.from, range.to),
    ]);
    const r = numberifyRow(rev[0]);
    return {
      revenue: r.revenue,
      revenueOrderCount: r.count,
      orderCount: all[0].count,
      pendingOrderCount: pending[0].count,
      newUserCount,
    };
  }

  async topProducts(
    range: ResolvedRange,
    limit = 5,
  ): Promise<{ items: TopProductItem[] }> {
    const rows = await this.prisma.$queryRaw<
      { productId: number; name: string; qty: bigint; rev: bigint }[]
    >(Prisma.sql`
      WITH paid AS (
        SELECT o.id FROM orders o WHERE ${REVENUE_ORDER} AND ${inRange(range)}
      )
      SELECT oi.product_id AS "productId",
             (array_agg(oi.product_name ORDER BY oi.id DESC))[1] AS name,
             SUM(oi.quantity)::bigint AS qty,
             SUM(oi.unit_price::bigint * oi.quantity)::bigint AS rev
      FROM order_items oi
      JOIN paid ON paid.id = oi.order_id
      GROUP BY oi.product_id
      ORDER BY qty DESC, rev DESC, oi.product_id ASC
      LIMIT ${limit}::int`);
    return {
      items: rows.map((r) => {
        const n = numberifyRow(r);
        return {
          productId: n.productId,
          name: n.name,
          quantity: n.qty,
          revenue: n.rev,
        };
      }),
    };
  }

  async orderStatus(range: ResolvedRange): Promise<OrderStatusResult> {
    const rows = await this.prisma.$queryRaw<
      { status: string; count: number }[]
    >(Prisma.sql`
      SELECT o.status::text AS status, COUNT(*)::int AS "count"
      FROM orders o
      WHERE ${inRange(range)}
      GROUP BY o.status`);
    const byStatus = new Map(rows.map((r) => [r.status, r.count]));
    return {
      items: ORDER_STATUSES.map((status) => ({
        status,
        count: byStatus.get(status) ?? 0,
      })),
    };
  }
}
