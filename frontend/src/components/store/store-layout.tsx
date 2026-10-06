import { Zap } from "lucide-react"
import { Link, NavLink, Outlet } from "react-router"
import { APP_NAME } from "@/components/auth/auth-shell"
import { LogoutButton } from "@/components/auth/logout-button"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/auth-context"
import { cn } from "@/lib/utils"

export function StoreLayout() {
  const { status, user } = useAuth()

  return (
    <div className="min-h-svh bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-brand-gradient text-white shadow-md shadow-black/20">
                <Zap className="size-4" />
              </span>
              <span className="text-sm font-semibold tracking-tight">
                {APP_NAME}
              </span>
            </Link>
            <NavLink
              to="/products"
              className={({ isActive }) =>
                cn(
                  "text-sm transition-colors duration-200",
                  isActive
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              Sản phẩm
            </NavLink>
          </div>

          {/* initializing: chưa biết ai đăng nhập, không hiện gì để tránh nhấp nháy */}
          {status === "authenticated" && (
            <div className="flex items-center gap-2">
              {user?.role === "ADMIN" && (
                <Button asChild variant="outline" size="sm">
                  <Link to="/admin">Quản trị</Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="sm">
                <Link to="/account">Tài khoản</Link>
              </Button>
              <LogoutButton />
            </div>
          )}
          {status === "anonymous" && (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">Đăng nhập</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/register">Đăng ký</Link>
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
