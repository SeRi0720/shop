import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"

const NEXT = { system: "light", light: "dark", dark: "system" } as const
const LABEL = { system: "Theo hệ thống", light: "Sáng", dark: "Tối" } as const
const ICON = { system: Monitor, light: Sun, dark: Moon } as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const Icon = ICON[theme]

  return (
    <Button
      variant="ghost"
      size="icon"
      title={`Giao diện: ${LABEL[theme]}`}
      aria-label={`Giao diện: ${LABEL[theme]}. Bấm để đổi`}
      onClick={() => setTheme(NEXT[theme])}
    >
      <Icon />
    </Button>
  )
}
