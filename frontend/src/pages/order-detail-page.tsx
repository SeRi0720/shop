import { CheckCircle2, PackageX } from "lucide-react"
import { Link, useLocation, useParams } from "react-router"
import { Notice } from "@/components/auth/notice"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
} from "@/features/orders/labels"
import { useOrder } from "@/features/orders/hooks"
import { getErrorMessage, isNotFound } from "@/lib/api"
import { formatDateTime, formatPrice } from "@/lib/format"
import { parseId } from "@/lib/parse-id"

function NotFound() {
  return (
    <EmptyState
      icon={PackageX}
      title="Không tìm thấy đơn hàng"
      description="Đơn hàng không tồn tại hoặc không thuộc tài khoản của bạn."
    >
      <Button asChild variant="outline">
        <Link to="/products">Tiếp tục mua sắm</Link>
      </Button>
    </EmptyState>
  )
}

function OrderSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-12 w-64" />
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}

export function OrderDetailPage() {
  const { id: rawId } = useParams()
  const id = parseId(rawId)
  const order = useOrder(id)
  const state = useLocation().state as { justPlaced?: boolean } | null

  if (id === null || isNotFound(order.error)) return <NotFound />
  if (order.isPending) return <OrderSkeleton />
  if (order.isError) {
    return (
      <div className="space-y-3">
        <Notice tone="error">
          {getErrorMessage(order.error, "Không tải được đơn hàng.")}
        </Notice>
        <Button variant="outline" onClick={() => order.refetch()}>
          Thử lại
        </Button>
      </div>
    )
  }

  const o = order.data

  return (
    <div className="animate-fade-up space-y-8">
      {state?.justPlaced && (
        <div
          role="status"
          className="flex items-start gap-3 border border-foreground bg-muted p-4"
        >
          <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0" />
          <div className="space-y-1">
            <p className="font-bold">Đặt hàng thành công</p>
            <p className="text-sm text-muted-foreground">
              Mã đơn #{o.id}. Bạn thanh toán bằng tiền mặt khi nhận hàng.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="label-mono text-muted-foreground">
            {formatDateTime(o.createdAt)}
          </p>
          <h1 className="text-4xl text-display sm:text-5xl">
            Đơn hàng #{o.id}
          </h1>
        </div>
        <Badge variant="outline">{ORDER_STATUS_LABEL[o.status]}</Badge>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
        <section className="border border-foreground bg-card">
          <ul>
            {o.items.map((line) => (
              <li
                key={line.productId}
                className="flex items-start justify-between gap-4 border-b border-foreground p-4"
              >
                <div className="min-w-0 space-y-1">
                  <p className="line-clamp-2 font-bold">{line.productName}</p>
                  <p className="label-mono text-muted-foreground tabular-nums">
                    {formatPrice(line.unitPrice)} × {line.quantity}
                  </p>
                </div>
                <p className="shrink-0 font-bold tabular-nums">
                  {formatPrice(line.lineTotal)}
                </p>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-4 p-4">
            <span className="label-mono text-muted-foreground">Tổng cộng</span>
            <span className="price-tag text-xl tabular-nums">
              {formatPrice(o.totalAmount)}
            </span>
          </div>
        </section>

        <aside className="space-y-6 border border-foreground bg-card p-5">
          <div className="space-y-2">
            <h2 className="label-mono">Giao hàng</h2>
            <p className="font-bold">{o.shippingName}</p>
            <p className="text-sm tabular-nums">{o.shippingPhone}</p>
            <p className="text-sm">{o.shippingAddress}</p>
            {o.note && (
              <p className="text-sm whitespace-pre-line text-muted-foreground">
                Ghi chú: {o.note}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <h2 className="label-mono">Thanh toán</h2>
            <p className="text-sm">{PAYMENT_METHOD_LABEL[o.paymentMethod]}</p>
            {o.paymentStatus && (
              <p className="text-sm text-muted-foreground">
                {PAYMENT_STATUS_LABEL[o.paymentStatus]}
              </p>
            )}
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link to="/products">Tiếp tục mua sắm</Link>
          </Button>
        </aside>
      </div>
    </div>
  )
}
