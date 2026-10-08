import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { LogoutButton } from "@/components/auth/logout-button"
import { useAuth } from "@/features/auth/auth-context"

/** Trang tạm dành cho người dùng đã đăng nhập; dùng để kiểm thử ProtectedRoute. Các tuần sau bổ sung lịch sử đơn hàng. */
export function AccountPage() {
  const { user } = useAuth()
  if (!user) return null // ProtectedRoute đã đảm bảo có user

  const rows: [string, string][] = [
    ["Họ và tên", user.fullName],
    ["Email", user.email],
    ["Số điện thoại", user.phone ?? "—"],
    ["Vai trò", user.role === "ADMIN" ? "Quản trị viên" : "Khách hàng"],
  ]

  return (
    <div className="mx-auto max-w-xl p-6 md:p-10">
      <div className="animate-fade-up space-y-6 border border-foreground bg-card p-7">
        <h1 className="text-2xl font-semibold tracking-tight">
          Tài khoản của tôi
        </h1>
        <dl className="divide-y text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/">Trang chủ</Link>
          </Button>
          {user.role === "ADMIN" && (
            <Button asChild variant="outline" size="sm">
              <Link to="/admin">Trang quản trị</Link>
            </Button>
          )}
          <LogoutButton className="ml-auto" />
        </div>
      </div>
    </div>
  )
}
