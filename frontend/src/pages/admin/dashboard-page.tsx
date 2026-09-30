import { LayoutDashboard } from "lucide-react"
import { useAuth } from "@/features/auth/auth-context"

/** Khung trống của khu quản trị; nội dung thật được thêm ở các tuần sau. */
export function AdminDashboardPage() {
  const { user } = useAuth()

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tổng quan</h1>
        <p className="text-sm text-muted-foreground">
          Xin chào, {user?.fullName}.
        </p>
      </div>

      <div className="grid place-items-center gap-3 rounded-2xl border border-dashed bg-card p-12 text-center shadow-sm">
        <div className="grid size-12 place-items-center rounded-xl bg-brand-from/10 text-brand-from">
          <LayoutDashboard className="size-6" />
        </div>
        <p className="font-medium">Chưa có nội dung</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Thống kê, quản lý sản phẩm, đơn hàng và người dùng sẽ được bổ sung ở
          các tuần sau.
        </p>
      </div>
    </div>
  )
}
