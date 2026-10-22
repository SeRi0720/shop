import { useState } from "react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { LogoutButton } from "@/components/auth/logout-button"
import { useAuth } from "@/features/auth/auth-context"
import { ProfileForm } from "@/features/auth/profile-form"

function InfoRows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 py-3">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function AccountPage() {
  const { user } = useAuth()
  const [editing, setEditing] = useState(false)
  if (!user) return null // ProtectedRoute đã đảm bảo có user

  const fixedRows: [string, string][] = [
    ["Email", user.email],
    ["Vai trò", user.role === "ADMIN" ? "Quản trị viên" : "Khách hàng"],
  ]

  return (
    <div className="mx-auto max-w-xl p-6 md:p-10">
      <div className="animate-fade-up space-y-6 border border-foreground bg-card p-7">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            Tài khoản của tôi
          </h1>
          {!editing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              Chỉnh sửa
            </Button>
          )}
        </div>

        {editing ? (
          <>
            <ProfileForm user={user} onDone={() => setEditing(false)} />
            <div className="space-y-1 border-t pt-4">
              <InfoRows rows={fixedRows} />
              <p className="text-xs text-muted-foreground">
                Email và vai trò không thể thay đổi.
              </p>
            </div>
          </>
        ) : (
          <InfoRows
            rows={[
              ["Họ và tên", user.fullName],
              ["Số điện thoại", user.phone ?? "—"],
              ...fixedRows,
            ]}
          />
        )}

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/">Trang chủ</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/orders">Đơn hàng của tôi</Link>
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
