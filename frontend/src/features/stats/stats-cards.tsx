import type { ReactNode } from "react"
import { Link } from "react-router"
import { Notice } from "@/components/auth/notice"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getErrorMessage } from "@/lib/api"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useStatsSummary } from "./hooks"
import type { StatsRange } from "./types"

const count = (n: number) => n.toLocaleString("vi-VN")

function Card({
  label,
  value,
  note,
  dim,
}: {
  label: string
  value: string
  note: ReactNode
  dim: boolean
}) {
  return (
    <div className="space-y-1 border border-foreground bg-card p-4">
      <p className="label-mono">{label}</p>
      <p
        className={cn(
          "text-3xl font-bold tabular-nums transition-opacity",
          dim && "opacity-60"
        )}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  )
}

export function StatsCards({ range }: { range: StatsRange }) {
  const summary = useStatsSummary(range)
  const s = summary.data

  if (summary.isError) {
    return (
      <div className="space-y-3">
        <Notice tone="error">
          {getErrorMessage(summary.error, "Không tải được số liệu tổng hợp.")}
        </Notice>
        <Button variant="outline" onClick={() => summary.refetch()}>
          Thử lại
        </Button>
      </div>
    )
  }
  if (!s) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    )
  }

  const dim = summary.isPlaceholderData
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card
        label="Doanh thu"
        value={formatPrice(s.revenue)}
        note={`${count(s.revenueOrderCount)} đơn đã thu tiền hoặc đang giao`}
        dim={dim}
      />
      <Card
        label="Số đơn"
        value={count(s.orderCount)}
        note="Đơn tạo trong kỳ, mọi trạng thái"
        dim={dim}
      />
      <Card
        label="Đơn chờ xử lý"
        value={count(s.pendingOrderCount)}
        note={
          <>
            Hiện tại, không theo kỳ.{" "}
            <Link
              to="/admin/orders?status=PENDING"
              className="underline underline-offset-4 hover:no-underline"
            >
              Xem đơn
            </Link>
          </>
        }
        dim={dim}
      />
      <Card
        label="Người dùng mới"
        value={count(s.newUserCount)}
        note="Tài khoản khách đăng ký trong kỳ"
        dim={dim}
      />
    </div>
  )
}
