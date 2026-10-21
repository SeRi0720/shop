import type { OrderStatus } from "@/features/orders/types"

export type Granularity = "day" | "month"

export interface StatsRange {
  from: string // yyyy-MM-dd, giờ VN
  to: string
}

export interface StatsSummary {
  revenue: number
  revenueOrderCount: number
  orderCount: number
  pendingOrderCount: number // không phụ thuộc kỳ
  newUserCount: number
}

export interface RevenueBucket {
  key: string // yyyy-MM-dd hoặc yyyy-MM
  revenue: number
  orderCount: number
}

export interface RevenueResult {
  granularity: Granularity
  items: RevenueBucket[]
}

export interface TopProduct {
  productId: number
  name: string
  quantity: number
  revenue: number
}

export interface OrderStatusResult {
  items: { status: OrderStatus; count: number }[]
}
