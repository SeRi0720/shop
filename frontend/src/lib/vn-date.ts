const dayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** Ngày hôm nay theo giờ VN, dạng yyyy-MM-dd (en-CA cho đúng định dạng này). */
export const todayVn = (now: Date = new Date()): string => dayFmt.format(now)

/** Cộng/trừ ngày trên chuỗi yyyy-MM-dd bằng số học UTC (không dính múi giờ máy). */
export function addDaysVn(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export type RangePreset = "7d" | "30d" | "90d" | "12m"

export interface PresetRange {
  from: string
  to: string
  granularity: "day" | "month"
}

export function rangeForPreset(
  preset: RangePreset,
  now: Date = new Date()
): PresetRange {
  const to = todayVn(now)
  if (preset === "12m") {
    const [y, m] = to.split("-").map(Number)
    // Ngày 1 của tháng cách đây 11 tháng: đủ 12 tháng gồm cả tháng hiện tại.
    const from = new Date(Date.UTC(y, m - 1 - 11, 1)).toISOString().slice(0, 10)
    return { from, to, granularity: "month" }
  }
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90
  return { from: addDaysVn(to, -(days - 1)), to, granularity: "day" }
}
