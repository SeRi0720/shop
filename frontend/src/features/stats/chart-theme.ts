export const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 }
export const AXIS_LINE = { stroke: "var(--foreground)" }
export const GRID_PROPS = {
  stroke: "var(--muted-foreground)",
  strokeOpacity: 0.25,
} as const

export const TOOLTIP_PROPS = {
  isAnimationActive: false,
  cursor: { fill: "var(--muted)" },
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--foreground)",
    borderRadius: 0,
    boxShadow: "none",
    fontSize: 12,
  },
  itemStyle: { color: "var(--foreground)" },
  labelStyle: { color: "var(--foreground)", fontWeight: 700 },
} as const
