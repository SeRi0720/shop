import axios from "axios"
import type { StockShortage } from "./types"

export function getStockShortages(error: unknown): StockShortage[] {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return []
  const items: unknown = error.response.data?.items
  return Array.isArray(items) ? (items as StockShortage[]) : []
}
