import { Link } from "react-router"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ForbiddenPage() {
  return (
    <div className="grid min-h-svh place-items-center px-4">
      <div className="w-full max-w-sm animate-fade-up space-y-5 rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto grid size-12 place-items-center rounded-xl bg-destructive/10 text-destructive">
          <ShieldAlert className="size-6" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">
            Không có quyền truy cập
          </h1>
          <p className="text-sm text-muted-foreground">
            Tài khoản của bạn không được phép xem trang này.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/">Về trang chủ</Link>
        </Button>
      </div>
    </div>
  )
}
