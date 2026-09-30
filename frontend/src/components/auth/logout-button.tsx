import { useState } from "react"
import { useNavigate } from "react-router"
import { Loader2, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/auth-context"

export function LogoutButton({
  variant = "ghost",
  className,
}: {
  variant?: "ghost" | "outline" | "destructive"
  className?: string
}) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    setBusy(true)
    await logout() // gọi /auth/logout (Public, không cần access token còn hạn)
    navigate("/login", { replace: true })
  }

  return (
    <Button
      variant={variant}
      size="sm"
      disabled={busy}
      onClick={handleClick}
      className={className}
    >
      {busy ? <Loader2 className="animate-spin" /> : <LogOut />}
      Đăng xuất
    </Button>
  )
}
