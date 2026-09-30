import { useState } from "react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { LogoutButton } from "@/components/auth/logout-button"
import { SessionLoading } from "@/components/auth/session-loading"
import { useAuth } from "@/features/auth/auth-context"
import { api } from "@/lib/api"

/**
 * TRANG TẠM: giữ phần "Công cụ thử" để kiểm thử ngày 7 (token hết hạn, nhiều request 401).
 * Sau khi test xong, thay bằng trang chủ thật ở Tuần 3-4.
 */
export function HomePage() {
  const { status, user } = useAuth()
  const [log, setLog] = useState("")
  const [busy, setBusy] = useState(false)

  async function run(label: string, count: number) {
    setBusy(true)
    const results = await Promise.allSettled(
      Array.from({ length: count }, () => api.get("/users/me"))
    )
    setLog(`${label}: ${results.map((r) => r.status).join(", ")}`)
    setBusy(false)
  }

  if (status === "initializing") return <SessionLoading />

  return (
    <div className="mx-auto max-w-xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">Trang chủ (tạm)</h1>
      <p className="text-sm text-muted-foreground">
        Trạng thái: <b>{status}</b>
        {user && (
          <>
            {" "}
            · {user.email} · {user.role}
          </>
        )}
      </p>

      {status === "authenticated" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/account">Tài khoản</Link>
            </Button>
            {user?.role === "ADMIN" && (
              <Button asChild variant="outline" size="sm">
                <Link to="/admin">Trang quản trị</Link>
              </Button>
            )}
            <LogoutButton variant="destructive" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => run("1 request", 1)}
            >
              Gọi /users/me
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => run("3 request song song", 3)}
            >
              Gọi 3 request song song
            </Button>
          </div>
          {log && (
            <p className="rounded-md bg-muted p-3 font-mono text-xs">{log}</p>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link to="/login">Đăng nhập</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/register">Đăng ký</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
