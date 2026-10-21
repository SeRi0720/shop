import { api } from "@/lib/api"
import type {
  Granularity,
  OrderStatusResult,
  RevenueResult,
  StatsRange,
  StatsSummary,
  TopProduct,
} from "./types"

export const fetchStatsSummary = (params: StatsRange) =>
  api.get<StatsSummary>("/admin/stats/summary", { params }).then((r) => r.data)

export const fetchStatsRevenue = (
  params: StatsRange & { granularity: Granularity }
) =>
  api.get<RevenueResult>("/admin/stats/revenue", { params }).then((r) => r.data)

export const fetchStatsTopProducts = (
  params: StatsRange & { limit?: number }
) =>
  api
    .get<{ items: TopProduct[] }>("/admin/stats/top-products", { params })
    .then((r) => r.data)

export const fetchStatsOrderStatus = (params: StatsRange) =>
  api
    .get<OrderStatusResult>("/admin/stats/order-status", { params })
    .then((r) => r.data)
