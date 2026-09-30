import { Navigate, Outlet, useLocation } from "react-router"
import { SessionLoading } from "@/components/auth/session-loading"
import { useAuth } from "@/features/auth/auth-context"
import { ForbiddenPage } from "@/pages/forbidden-page"

/**
 * Quy tắc chung của cả hai guard:
 *  - `initializing`: chưa biết ai đang đăng nhập, chỉ hiện spinner, TUYỆT ĐỐI không chuyển hướng
 *    (nếu không, F5 ở trang bảo vệ sẽ bị đẩy về /login trước khi khởi động xong).
 *  - `anonymous`: chuyển về /login và nhớ trang đang vào (state.from) để quay lại sau khi đăng nhập.
 */
function useGuardState() {
  const { status, user } = useAuth()
  const location = useLocation()
  return { status, user, from: `${location.pathname}${location.search}` }
}

export function ProtectedRoute() {
  const { status, from } = useGuardState()
  if (status === "initializing") return <SessionLoading />
  if (status === "anonymous")
    return <Navigate to="/login" replace state={{ from }} />
  return <Outlet />
}

export function AdminRoute() {
  const { status, user, from } = useGuardState()
  if (status === "initializing") return <SessionLoading />
  if (status === "anonymous")
    return <Navigate to="/login" replace state={{ from }} />
  // Đã đăng nhập nhưng không phải ADMIN: hiện trang 403 (không chuyển hướng lặng lẽ).
  // Đây chỉ là chặn ở giao diện; chặn thật sự nằm ở RolesGuard của backend.
  if (user?.role !== "ADMIN") return <ForbiddenPage />
  return <Outlet />
}
