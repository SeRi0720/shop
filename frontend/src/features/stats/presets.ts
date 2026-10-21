import type { RangePreset } from "@/lib/vn-date"

export const PRESET_LABEL: Record<RangePreset, string> = {
  "7d": "7 ngày",
  "30d": "30 ngày",
  "90d": "90 ngày",
  "12m": "12 tháng",
}
export const PRESET_OPTIONS = Object.keys(PRESET_LABEL) as RangePreset[]
export const DEFAULT_PRESET: RangePreset = "30d"
