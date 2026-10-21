import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  fetchStatsOrderStatus,
  fetchStatsRevenue,
  fetchStatsSummary,
  fetchStatsTopProducts,
} from "./api"
import type { Granularity, StatsRange } from "./types"

const STALE_MS = 60_000

export function useStatsSummary(range: StatsRange) {
  return useQuery({
    queryKey: ["stats", "summary", range],
    queryFn: () => fetchStatsSummary(range),
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  })
}

export function useStatsRevenue(range: StatsRange, granularity: Granularity) {
  return useQuery({
    queryKey: ["stats", "revenue", { ...range, granularity }],
    queryFn: () => fetchStatsRevenue({ ...range, granularity }),
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  })
}

export function useStatsTopProducts(range: StatsRange, limit = 5) {
  return useQuery({
    queryKey: ["stats", "top-products", { ...range, limit }],
    queryFn: () => fetchStatsTopProducts({ ...range, limit }),
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  })
}

export function useStatsOrderStatus(range: StatsRange) {
  return useQuery({
    queryKey: ["stats", "order-status", range],
    queryFn: () => fetchStatsOrderStatus(range),
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  })
}

/** Nút "Làm mới": đánh dấu cũ mọi khối thống kê, các khối đang hiển thị tự tải lại. */
export function useRefreshStats() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ["stats"] })
}
