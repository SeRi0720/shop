import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ORDER_STATUS_LABEL } from "@/features/orders/labels"
import { AXIS_LINE, AXIS_TICK, GRID_PROPS, TOOLTIP_PROPS } from "./chart-theme"
import { ChartBlock } from "./chart-block"
import { useStatsOrderStatus } from "./hooks"
import type { StatsRange } from "./types"

export function OrderStatusChart({ range }: { range: StatsRange }) {
  const query = useStatsOrderStatus(range)

  return (
    <ChartBlock
      title="Đơn theo trạng thái"
      hint="Đơn tạo trong kỳ"
      query={query}
      isEmpty={(d) => d.items.every((i) => i.count === 0)}
    >
      {(data) => {
        const rows = data.items.map((i) => ({
          name: ORDER_STATUS_LABEL[i.status],
          count: i.count,
        }))
        return (
          <>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={rows}
                  margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                >
                  <CartesianGrid horizontal={false} {...GRID_PROPS} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={AXIS_TICK}
                    axisLine={AXIS_LINE}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip {...TOOLTIP_PROPS} />
                  <Bar
                    dataKey="count"
                    name="Số đơn"
                    fill="var(--chart-2)"
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table className="sr-only">
              <caption>Số đơn theo trạng thái</caption>
              <thead>
                <tr>
                  <th>Trạng thái</th>
                  <th>Số đơn</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td>{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )
      }}
    </ChartBlock>
  )
}
