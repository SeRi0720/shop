import { Link, NavLink, Outlet } from "react-router"
import {
  LayoutDashboard,
  Package,
  ReceiptText,
  Tags,
  Users,
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
  "relative flex items-center gap-3 border-b border-border/25 px-5 py-3 text-sm font-medium transition-colors"

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
    <Link
      to="/"
      aria-label={`${APP_NAME} - về trang chủ`}
      className="block leading-tight transition-colors hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
    >
      <p className="label-mono text-sm font-bold">{APP_NAME}®</p>
      <p className="label-mono text-muted-foreground">Quản trị</p>
    </Link>
  )
}

/**
 * Trang dữ liệu giữ nền phẳng dễ đọc: chỉ dùng đường kẻ 1px để chia vùng,
 * không đổ bóng, không kính mờ.
 */
export function AdminLayout() {
  const { user } = useAuth()

  return (
    <div className="min-h-svh bg-background md:flex">
      {/* Thanh bên: từ màn hình md trở lên */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-foreground bg-card md:flex">
        <div className="flex h-16 items-center border-b border-foreground px-5">
          <Brand />
        </div>
        <nav aria-label="Quản trị" className="flex-1">
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
                      ? "bg-foreground text-background"
                      : "text-foreground hover:bg-muted"
                  )
                }
              >
                <Icon className="size-4" />
                {label}
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
                <span className="border border-current px-1.5 py-0.5 label-mono text-[10px]">
                  {soon}
                </span>
              </div>
            )
          )}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header + menu ngang (chỉ điện thoại) dính trên cùng */}
        <div className="sticky top-0 z-10 border-b border-foreground bg-background">
          <header className="flex h-16 items-center justify-between px-4 md:px-8">
            <div className="md:hidden">
              <Brand />
            </div>
            <p className="hidden label-mono text-muted-foreground md:block">
              Khu vực quản trị
            </p>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center bg-foreground label-mono font-bold text-background">
                  {user ? initials(user.fullName) : ""}
                </div>
                <div className="hidden leading-tight sm:block">
                  <p className="text-sm font-bold">{user?.fullName}</p>
                  <p className="label-mono text-muted-foreground">
                    Quản trị viên
                  </p>
                </div>
              </div>
              <ThemeToggle />
              <LogoutButton />
            </div>
          </header>

          {/* Chỉ liệt kê mục đã có trang thật; mục "sắp có" bỏ qua cho gọn */}
          <nav
            aria-label="Quản trị (điện thoại)"
            className="flex gap-1 overflow-x-auto border-t border-foreground px-3 py-2 md:hidden"
          >
            {NAV.filter((item) => item.to).map(
              ({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={label}
                  to={to!}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      "flex shrink-0 items-center gap-2 border px-3 py-2 label-mono whitespace-nowrap transition-colors",
                      isActive
                        ? "border-foreground bg-foreground text-background"
                        : "border-transparent hover:border-foreground"
                    )
                  }
                >
                  <Icon className="size-4" />
                  {label}
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
