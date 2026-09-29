import type { ReactNode } from "react"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

const tones = {
  error: {
    icon: AlertCircle,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  success: {
    icon: CheckCircle2,
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
}

export function Notice({
  tone,
  children,
}: {
  tone: keyof typeof tones
  children: ReactNode
}) {
  const { icon: Icon, className } = tones[tone]
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex animate-fade-up items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm",
        className
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  )
}
