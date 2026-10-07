import { NavLink, Outlet } from "react-router"
import {
  LayoutDashboard,
  Package,
  ReceiptText,
  Tags,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { APP_NAME } from "@/components/auth/auth-shell"
import { LogoutButton } from "@/components/auth/logout-button"
import { useAuth } from "@/features/auth/auth-context"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

// Mục chưa có trang thật hiện mờ kèm tuần sẽ làm (theo mục 7 của PROJECT_CONTEXT).
const NAV: {
  to?: string
  label: string
  icon: LucideIcon
  soon?: string
  end?: boolean
}[] = [
  { to: "/admin", label: "Tổng quan", icon: LayoutDashboard, end: true },
  { to: "/admin/products", label: "Sản phẩm", icon: Package },
  { to: "/admin/catalog", label: "Danh mục & thương hiệu", icon: Tags },
  { label: "Đơn hàng", icon: ReceiptText, soon: "Tuần 5" },
  { label: "Người dùng", icon: Users, soon: "Tuần 7" },
]

const itemBase =
  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-200"

function initials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-9 place-items-center rounded-xl bg-brand-gradient text-white shadow-md shadow-black/20">
        <Zap className="size-4" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-tight">{APP_NAME}</p>
        <p className="text-xs text-muted-foreground">Quản trị</p>
      </div>
    </div>
  )
}

/**
 * Trang dữ liệu nên giữ nền sạch (xem mục 4 của PROJECT_CONTEXT): chỉ dùng chút chiều sâu
 * ở thanh bên và thanh trên (kính mờ, viền mảnh), vùng nội dung là nền phẳng dễ đọc.
 */
export function AdminLayout() {
  const { user } = useAuth()

  return (
    <div className="min-h-svh bg-muted/30 md:flex">
      {/* Thanh bên: từ màn hình md trở lên */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card/70 backdrop-blur md:flex">
        <div className="flex h-16 items-center border-b px-5">
          <Brand />
        </div>
        <nav aria-label="Quản trị" className="flex-1 space-y-1 p-3">
          {NAV.map(({ to, label, icon: Icon, soon, end }) =>
            to ? (
              <NavLink
                key={label}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    itemBase,
                    isActive
                      ? "bg-brand-from/10 font-medium text-foreground before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-brand-gradient"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn("size-4", isActive && "text-brand-from")}
                    />
                    {label}
                  </>
                )}
              </NavLink>
            ) : (
              <div
                key={label}
                aria-disabled
                className={cn(
                  itemBase,
                  "cursor-not-allowed text-muted-foreground/60"
                )}
              >
                <Icon className="size-4" />
                <span className="flex-1">{label}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                  {soon}
                </span>
              </div>
            )
          )}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header + menu ngang (chỉ điện thoại) dính trên cùng */}
        <div className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur">
          <header className="flex h-16 items-center justify-between px-4 md:px-8">
            <div className="md:hidden">
              <Brand />
            </div>
            <p className="hidden text-sm text-muted-foreground md:block">
              Khu vực quản trị
            </p>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-full bg-brand-gradient text-xs font-medium text-white">
                  {user ? initials(user.fullName) : ""}
                </div>
                <div className="hidden leading-tight sm:block">
                  <p className="text-sm font-medium">{user?.fullName}</p>
                  <p className="text-xs text-muted-foreground">Quản trị viên</p>
                </div>
              </div>
              <ThemeToggle />
              <LogoutButton />
            </div>
          </header>

          {/* Chỉ liệt kê mục đã có trang thật; mục "sắp có" bỏ qua cho gọn */}
          <nav
            aria-label="Quản trị (điện thoại)"
            className="flex gap-1 overflow-x-auto border-t px-3 py-2 md:hidden"
          >
            {NAV.filter((item) => item.to).map(
              ({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={label}
                  to={to!}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      "flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-colors duration-200",
                      isActive
                        ? "bg-brand-from/10 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={cn("size-4", isActive && "text-brand-from")}
                      />
                      {label}
                    </>
                  )}
                </NavLink>
              )
            )}
          </nav>
        </div>

        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
