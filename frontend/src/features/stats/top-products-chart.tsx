import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatPrice } from "@/lib/format"
import { AXIS_LINE, AXIS_TICK, GRID_PROPS, TOOLTIP_PROPS } from "./chart-theme"
import { ChartBlock } from "./chart-block"
import { useStatsTopProducts } from "./hooks"
import type { StatsRange } from "./types"

const shorten = (s: string) => (s.length > 20 ? `${s.slice(0, 19)}…` : s)

export function TopProductsChart({ range }: { range: StatsRange }) {
  const query = useStatsTopProducts(range)

  return (
    <ChartBlock
      title="Top sản phẩm"
      hint="Theo số lượng bán, trên đơn tính doanh thu"
      query={query}
      isEmpty={(d) => d.items.length === 0}
    >
      {(data) => (
        <>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={data.items}
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
                  width={140}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={shorten}
                />
                <Tooltip {...TOOLTIP_PROPS} />
                <Bar
                  dataKey="quantity"
                  name="Đã bán"
                  fill="var(--chart-1)"
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>Top sản phẩm bán chạy</caption>
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Số lượng</th>
                <th>Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.productId}>
                  <td>{p.name}</td>
                  <td>{p.quantity}</td>
                  <td>{formatPrice(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </ChartBlock>
  )
}
