import type { Granularity } from "./types"

/** Khóa nhóm -> nhãn: ngày "24/10" (đủ: "24/10/2026"), tháng "10/2026". */
export function formatBucketKey(key: string, g: Granularity, full = false) {
  if (g === "month") {
    const [y, m] = key.split("-")
    return `${m}/${y}`
  }
  const [y, m, d] = key.split("-")
  return full ? `${d}/${m}/${y}` : `${d}/${m}`
}
