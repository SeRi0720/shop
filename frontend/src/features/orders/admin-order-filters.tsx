import { Search, X } from "lucide-react"
import { useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useUrlTextParam } from "@/lib/use-url-text-param"
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_SHORT } from "./labels"
import { parseAdminOrderParams } from "./order-params"
import type { OrderStatus, PaymentMethod } from "./types"

const FILTER_KEYS = ["q", "status", "paymentMethod", "from", "to"]
const STATUS_OPTIONS = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]
const METHOD_OPTIONS = Object.keys(PAYMENT_METHOD_SHORT) as PaymentMethod[]
const fromSelect = (v: string) => (v === "all" ? undefined : v)

export function AdminOrderFilters() {
  const [sp, setSearchParams] = useSearchParams()
  const params = parseAdminOrderParams(sp)
  const [q, setQ] = useUrlTextParam("q", (sp.get("q") ?? "").trim())
  const hasFilters = FILTER_KEYS.some((key) => sp.has(key))

  function setParam(name: string, value: string | undefined) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(name, value)
        else next.delete(name)
        next.delete("page") // đổi bộ lọc thì về trang 1
        return next
      },
      { replace: true }
    )
  }

  return (
    <div className="space-y-3 border border-foreground bg-card p-4">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo mã đơn, tên hoặc số điện thoại..."
          aria-label="Tìm đơn hàng"
          className="h-11 pl-10"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Select
          value={params.status ?? "all"}
          onValueChange={(v) => setParam("status", fromSelect(v))}
        >
          <SelectTrigger
            aria-label="Lọc theo trạng thái"
            className="h-10 w-full"
          >
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi trạng thái</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={params.paymentMethod ?? "all"}
          onValueChange={(v) => setParam("paymentMethod", fromSelect(v))}
        >
          <SelectTrigger
            aria-label="Lọc theo phương thức thanh toán"
            className="h-10 w-full"
          >
            <SelectValue placeholder="Thanh toán" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi phương thức</SelectItem>
            {METHOD_OPTIONS.map((m) => (
              <SelectItem key={m} value={m}>
                {PAYMENT_METHOD_SHORT[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={params.from ?? ""}
          max={params.to}
          onChange={(e) => setParam("from", e.target.value || undefined)}
          aria-label="Từ ngày"
          className="h-10"
        />
        <Input
          type="date"
          value={params.to ?? ""}
          min={params.from}
          onChange={(e) => setParam("to", e.target.value || undefined)}
          aria-label="Đến ngày"
          className="h-10"
        />

        {hasFilters && (
          <Button
            variant="outline"
            className="h-10"
            onClick={() =>
              setSearchParams(new URLSearchParams(), { replace: true })
            }
          >
            <X />
            Xóa bộ lọc
          </Button>
        )}
      </div>
    </div>
  )
}
