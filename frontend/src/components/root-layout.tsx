import { Outlet } from "react-router"
import { AuthProvider } from "@/features/auth/auth-provider"

// AuthProvider đặt trong router (không phải ngoài) để dùng được useNavigate.
export function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}
