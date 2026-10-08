import { Loader2 } from "lucide-react"

/** Màn hình chờ khi app chưa biết đã đăng nhập hay chưa (trạng thái `initializing`). */
export function SessionLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid min-h-svh place-items-center bg-background"
    >
      {/* Trễ 150ms: tải nhanh thì không nháy spinner, tải chậm mới hiện */}
      <div
        className="flex animate-fade-up flex-col items-center gap-3"
        style={{ animationDelay: "150ms" }}
      >
        <Loader2 className="size-6 animate-spin text-foreground" />
        <span className="label-mono text-muted-foreground">
          Đang tải phiên đăng nhập...
        </span>
      </div>
    </div>
  )
}
