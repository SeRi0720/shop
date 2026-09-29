import { useState } from "react"
import { useNavigate } from "react-router"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/auth-context"
import { api } from "@/lib/api"

export function HomePage() {
  const { status, user, logout } = useAuth()
  const navigate = useNavigate()
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

  if (status === "initializing") {
    return (
      <div className="grid min-h-svh place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

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
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => run("1 request", 1)}
            >
              Gọi /users/me
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => run("3 request song song", 3)}
            >
              Gọi 3 request song song
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await logout()
                navigate("/login", { replace: true })
              }}
            >
              Đăng xuất
            </Button>
          </div>
          {log && (
            <p className="rounded-md bg-muted p-3 font-mono text-xs">{log}</p>
          )}
        </div>
      ) : (
        <Button onClick={() => navigate("/login")}>Đến trang đăng nhập</Button>
      )}
    </div>
  )
}
