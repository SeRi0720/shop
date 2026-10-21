import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatCompactVnd, formatPrice } from "@/lib/format"
import { AXIS_LINE, AXIS_TICK, GRID_PROPS, TOOLTIP_PROPS } from "./chart-theme"
import { ChartBlock } from "./chart-block"
import { formatBucketKey } from "./format"
import { useStatsRevenue } from "./hooks"
import type { Granularity, StatsRange } from "./types"

export function RevenueChart({
  range,
  granularity,
}: {
  range: StatsRange
  granularity: Granularity
}) {
  const query = useStatsRevenue(range, granularity)

  return (
    <ChartBlock
      title="Doanh thu"
      hint="Tính theo ngày đặt hàng, UTC+7"
      query={query}
      isEmpty={(d) => d.items.every((b) => b.orderCount === 0)}
    >
      {/* Nhãn trục theo granularity của DỮ LIỆU trả về, không theo state:
          lúc đổi mức, keepPreviousData còn giữ dữ liệu cũ vài trăm ms. */}
      {(data) => (
        <>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.items}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid vertical={false} {...GRID_PROPS} />
                <XAxis
                  dataKey="key"
                  tick={AXIS_TICK}
                  axisLine={AXIS_LINE}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={16}
                  tickFormatter={(k: string) =>
                    formatBucketKey(k, data.granularity)
                  }
                />
                <YAxis
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  tickFormatter={formatCompactVnd}
                />
                <Tooltip
                  {...TOOLTIP_PROPS}
                  labelFormatter={(k) =>
                    formatBucketKey(String(k), data.granularity, true)
                  }
                  formatter={(v) => formatPrice(Number(v))}
                />
                <Bar
                  dataKey="revenue"
                  name="Doanh thu"
                  fill="var(--chart-5)"
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>
              Doanh thu theo {data.granularity === "day" ? "ngày" : "tháng"}
            </caption>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Doanh thu</th>
                <th>Số đơn</th>
              </tr>
            </thead>
            <tbody>
              {data.items
                .filter((b) => b.orderCount > 0)
                .map((b) => (
                  <tr key={b.key}>
                    <td>{formatBucketKey(b.key, data.granularity, true)}</td>
                    <td>{formatPrice(b.revenue)}</td>
                    <td>{b.orderCount}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}
    </ChartBlock>
  )
}
