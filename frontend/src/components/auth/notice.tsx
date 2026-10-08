import type { ReactNode } from "react"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

const tones = {
  error: {
    icon: AlertCircle,
    className: "border-destructive bg-transparent text-destructive",
  },
  success: {
    icon: CheckCircle2,
    className: "border-foreground bg-muted text-foreground",
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
        "flex animate-fade-up items-start gap-2.5 rounded-none border px-3.5 py-3 text-sm",
        className
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  )
}
