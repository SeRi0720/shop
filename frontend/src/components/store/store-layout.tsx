import { Link, NavLink, Outlet } from "react-router"
import { APP_NAME } from "@/components/auth/auth-shell"
import { LogoutButton } from "@/components/auth/logout-button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/auth-context"
import { cn } from "@/lib/utils"
import { ShoppingCart } from "lucide-react"
import { useCart } from "@/features/cart/hooks"

export function StoreLayout() {
  const { status, user } = useAuth()
  const cart = useCart()
  const cartCount = cart.data?.totalQuantity ?? 0

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-foreground bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-stretch justify-between">
          <div className="flex items-stretch">
            <Link
              to="/"
              className="flex items-center border-r border-foreground px-4 label-mono text-sm font-bold sm:px-6"
            >
              {APP_NAME}®
            </Link>
            <NavLink
              to="/products"
              className={({ isActive }) =>
                cn(
                  "flex items-center border-r border-foreground px-4 label-mono transition-colors sm:px-6",
                  isActive ? "bg-foreground text-background" : "hover:bg-muted"
                )
              }
            >
              Sản phẩm
            </NavLink>
          </div>

          <div className="flex items-center gap-1 px-4 sm:gap-2 sm:px-6">
            <ThemeToggle />
            {/* initializing: chưa biết ai đăng nhập, không hiện gì để tránh nhấp nháy */}
            {status === "authenticated" && (
              <>
                {user?.role === "ADMIN" && (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/admin">Quản trị</Link>
                  </Button>
                )}
                <Button
                  asChild
                  variant="ghost"
                  size="icon-sm"
                  className="relative"
                >
                  <Link
                    to="/cart"
                    aria-label={
                      cartCount > 0
                        ? `Giỏ hàng, ${cartCount} sản phẩm`
                        : "Giỏ hàng"
                    }
                  >
                    <ShoppingCart />
                    {cartCount > 0 && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center bg-foreground px-1 label-mono text-[10px] leading-none text-background"
                      >
                        {cartCount > 99 ? "99+" : cartCount}
                      </span>
                    )}
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex"
                >
                  <Link to="/account">Tài khoản</Link>
                </Button>
                <LogoutButton />
              </>
            )}
            {status === "anonymous" && (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/login">Đăng nhập</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/register">Đăng ký</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      <footer className="overflow-hidden border-t border-foreground bg-foreground text-background">
        <div className="mx-auto max-w-6xl px-4 pt-6 pb-4 sm:px-6">
          <div className="flex items-center justify-between label-mono">
            <span>{APP_NAME}®</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <p
            aria-hidden
            className="mt-12 text-display select-none"
            style={{ fontSize: "clamp(4rem, 16vw, 11rem)" }}
          >
            {APP_NAME}
          </p>
        </div>
      </footer>
    </div>
  )
}
