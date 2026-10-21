import { useMemo, useState } from "react"
import { useIsFetching } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/features/auth/auth-context"
import { OrderStatusChart } from "@/features/stats/order-status-chart"
import { formatBucketKey } from "@/features/stats/format"
import { useRefreshStats } from "@/features/stats/hooks"
import {
  DEFAULT_PRESET,
  PRESET_LABEL,
  PRESET_OPTIONS,
} from "@/features/stats/presets"
import { RevenueChart } from "@/features/stats/revenue-chart"
import { StatsCards } from "@/features/stats/stats-cards"
import { TopProductsChart } from "@/features/stats/top-products-chart"
import { rangeForPreset, type RangePreset } from "@/lib/vn-date"

export function AdminDashboardPage() {
  const { user } = useAuth()
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET)
  const { from, to, granularity } = useMemo(
    () => rangeForPreset(preset),
    [preset]
  )
  const range = useMemo(() => ({ from, to }), [from, to])
  const refresh = useRefreshStats()
  const fetching = useIsFetching({ queryKey: ["stats"] }) > 0

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl text-display">Tổng quan</h1>
          <p className="text-sm text-muted-foreground">
            Xin chào, {user?.fullName}. Kỳ {formatBucketKey(from, "day", true)}{" "}
            – {formatBucketKey(to, "day", true)} (UTC+7).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={preset}
            onValueChange={(v) => setPreset(v as RangePreset)}
          >
            <SelectTrigger aria-label="Khoảng thời gian" className="h-10 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESET_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRESET_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="h-10"
            disabled={fetching}
            onClick={refresh}
          >
            {fetching ? "Đang tải..." : "Làm mới"}
          </Button>
        </div>
      </div>

      <StatsCards range={range} />
      <RevenueChart range={range} granularity={granularity} />
      <div className="grid gap-6 lg:grid-cols-2">
        <TopProductsChart range={range} />
        <OrderStatusChart range={range} />
      </div>
    </div>
  )
}
