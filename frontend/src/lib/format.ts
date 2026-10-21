const vnd = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
})

export const formatPrice = (value: number) => vnd.format(value)

const dateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
})

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))

const time = new Intl.DateTimeFormat("vi-VN", {
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
})

export const formatTime = (iso: string) => time.format(new Date(iso))

/** Rút gọn số tiền cho trục biểu đồ: 12 tr, 1,2 tỷ. */
export function formatCompactVnd(value: number): string {
  const abs = Math.abs(value)
  const fmt = (n: number) =>
    n.toLocaleString("vi-VN", { maximumFractionDigits: 1 })
  if (abs >= 1e9) return `${fmt(value / 1e9)} tỷ`
  if (abs >= 1e6) return `${fmt(value / 1e6)} tr`
  if (abs >= 1e3) return `${fmt(value / 1e3)} k`
  return fmt(value)
}
