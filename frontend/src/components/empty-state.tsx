import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <div className="grid place-items-center gap-3 rounded-2xl border border-dashed bg-card p-12 text-center">
      <div className="grid size-12 place-items-center rounded-xl bg-brand-from/10 text-brand-from">
        <Icon aria-hidden className="size-6" />
      </div>
      <p className="font-medium">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {children}
    </div>
  )
}
