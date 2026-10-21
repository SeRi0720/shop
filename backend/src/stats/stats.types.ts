import type { OrderStatusValue } from '../order/order-state';
import type { RevenueBucket } from './stats-buckets';
import type { Granularity } from './stats-range';

export interface StatsSummary {
  revenue: number;
  revenueOrderCount: number;
  orderCount: number;
  pendingOrderCount: number; // không phụ thuộc kỳ
  newUserCount: number;
}
export interface RevenueResult {
  granularity: Granularity;
  items: RevenueBucket[];
}
export interface TopProductItem {
  productId: number;
  name: string;
  quantity: number;
  revenue: number;
}
export interface OrderStatusResult {
  items: { status: OrderStatusValue; count: number }[];
}
