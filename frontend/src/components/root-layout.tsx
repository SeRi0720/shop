import { Outlet } from "react-router"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/features/auth/auth-provider"
import { ChatProvider } from "@/features/chat/chat-provider"

export function RootLayout() {
  return (
    <AuthProvider>
      <ChatProvider>
        <Outlet />
        <Toaster richColors position="top-right" />
      </ChatProvider>
    </AuthProvider>
  )
}
