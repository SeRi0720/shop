import type { LucideIcon } from "lucide-react"
import { NavLink } from "react-router"
import { cn } from "@/lib/utils"

export function HeaderNavLink({
  to,
  label,
  icon: Icon,
  badge = 0,
  ariaLabel,
}: {
  to: string
  label: string
  icon: LucideIcon
  badge?: number
  ariaLabel?: string
}) {
  return (
    <NavLink
      to={to}
      title={label}
      aria-label={ariaLabel ?? label}
      className={({ isActive }) =>
        cn(
          "relative flex h-8 items-center gap-2 px-2 label-mono transition-colors",
          isActive ? "bg-foreground text-background" : "hover:bg-muted"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="size-4" />
          <span className="hidden xl:inline">{label}</span>
          {badge > 0 && (
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center border border-foreground px-1 label-mono text-[10px] leading-none",
                // Khi nút đang tô đen, huy hiệu phải đảo màu để không chìm vào nền.
                isActive
                  ? "bg-background text-foreground"
                  : "bg-foreground text-background"
              )}
            >
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}
