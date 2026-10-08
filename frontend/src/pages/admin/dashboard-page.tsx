import { LayoutDashboard } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { useAuth } from "@/features/auth/auth-context"

/** Khung trống của khu quản trị; nội dung thật được thêm ở các tuần sau. */
export function AdminDashboardPage() {
  const { user } = useAuth()

  return (
    <div className="animate-fade-up space-y-6">
      <div className="space-y-1">
        <h1 className="text-4xl text-display">Tổng quan</h1>
        <p className="text-sm text-muted-foreground">
          Xin chào, {user?.fullName}.
        </p>
      </div>

      <EmptyState
        icon={LayoutDashboard}
        title="Chưa có nội dung"
        description="Thống kê, quản lý sản phẩm, đơn hàng và người dùng sẽ được bổ sung ở các tuần sau."
      />
    </div>
  )
}
