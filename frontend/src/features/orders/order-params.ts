import type { AdminOrderListParams, OrderStatus, PaymentMethod } from "./types"

export const ADMIN_ORDER_PAGE_SIZE = 10
const STATUSES: OrderStatus[] = [
  "PENDING",
  "PAID",
  "SHIPPING",
  "COMPLETED",
  "CANCELLED",
]
const METHODS: PaymentMethod[] = ["COD", "VNPAY"]
const MAX_PAGE = 100000 // khớp OrderListQueryDto

function toInt(
  raw: string | null,
  min: number,
  max: number
): number | undefined {
  const s = raw?.trim()
  if (!s || !/^\d+$/.test(s)) return undefined
  const n = Number(s)
  return n >= min && n <= max ? n : undefined
}

/** Chỉ nhận ngày có thật dạng yyyy-MM-dd (2026-02-31 bị loại). */
function toDay(raw: string | null): string | undefined {
  const s = raw?.trim()
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
    ? s
    : undefined
}

/** Tham số rỗng hoặc sai thì bỏ; `limit` luôn cố định; from > to thì hoán đổi (backend từ chối). */
export function parseAdminOrderParams(
  sp: URLSearchParams
): AdminOrderListParams {
  const status = sp.get("status") as OrderStatus | null
  const method = sp.get("paymentMethod") as PaymentMethod | null
  let from = toDay(sp.get("from"))
  let to = toDay(sp.get("to"))
  if (from && to && from > to) [from, to] = [to, from]
  return {
    status: status && STATUSES.includes(status) ? status : undefined,
    paymentMethod: method && METHODS.includes(method) ? method : undefined,
    q: sp.get("q")?.trim().slice(0, 100) || undefined,
    from,
    to,
    page: toInt(sp.get("page"), 1, MAX_PAGE) ?? 1,
    limit: ADMIN_ORDER_PAGE_SIZE,
  }
}
