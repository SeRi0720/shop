import { Outlet } from "react-router"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/features/auth/auth-provider"

// AuthProvider đặt trong router (không phải ngoài) để dùng được useNavigate.
export function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster richColors position="top-right" />
    </AuthProvider>
  )
}
