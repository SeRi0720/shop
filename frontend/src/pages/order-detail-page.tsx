import { useState } from "react"
import { CheckCircle2, Clock, Loader2, PackageX } from "lucide-react"
import { Link, useLocation, useParams, useSearchParams } from "react-router"
import { toast } from "sonner"
import { Notice } from "@/components/auth/notice"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useCancelOrder,
  useCheckPayment,
  useOrder,
} from "@/features/orders/hooks"
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
} from "@/features/orders/labels"
import {
  OrderItems,
  PaymentInfo,
  ShippingInfo,
} from "@/features/orders/order-parts"
import type { Order } from "@/features/orders/types"
import { getErrorMessage, isNotFound } from "@/lib/api"
import { formatDateTime, formatTime } from "@/lib/format"
import { parseId } from "@/lib/parse-id"
import { useCooldown } from "@/lib/use-cooldown"
import { useNow } from "@/lib/use-now"

const CHECK_COOLDOWN_S = 10

function NotFound() {
  return (
    <EmptyState
      icon={PackageX}
      title="Không tìm thấy đơn hàng"
      description="Đơn hàng không tồn tại hoặc không thuộc tài khoản của bạn."
    >
      <Button asChild variant="outline">
        <Link to="/orders">Đơn hàng của tôi</Link>
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

/** Thông báo thanh toán VNPay. Luôn dựa vào trạng thái THẬT của đơn; `hint` (?vnpay=) chỉ chọn lời nhắn. */
function PaymentBanner({
  order,
  hint,
  cooldown,
  checking,
  onCheck,
}: {
  order: Order
  hint: string | null
  cooldown: number
  checking: boolean
  onCheck: () => void
}) {
  if (order.paymentMethod !== "VNPAY") return null

  if (order.status === "PENDING") {
    const until = order.paymentExpiresAt
      ? formatTime(order.paymentExpiresAt)
      : null
    return (
      <div
        role="status"
        className="space-y-3 border border-foreground bg-muted p-4"
      >
        <div className="flex items-start gap-3">
          <Clock aria-hidden className="mt-0.5 size-5 shrink-0" />
          <div className="space-y-1">
            <p className="font-bold">Đang chờ xác nhận thanh toán</p>
            <p className="text-sm text-muted-foreground">
              {hint === "failed" &&
                "Bạn đã hủy hoặc chưa hoàn tất thanh toán trên VNPay. "}
              {until && `Đơn sẽ tự hủy sau ${until} nếu chưa thanh toán. `}
              Trang tự cập nhật trong khoảng 90 giây. Nếu bạn đã thanh toán mà
              chưa thấy thay đổi, bấm “Kiểm tra thanh toán” hoặc tải lại trang.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onCheck}
          disabled={checking || cooldown > 0}
        >
          {checking && <Loader2 className="animate-spin" />}
          {cooldown > 0
            ? `Kiểm tra thanh toán (${cooldown}s)`
            : "Kiểm tra thanh toán"}
        </Button>
      </div>
    )
  }

  if (order.status === "CANCELLED") {
    return order.paymentStatus === "SUCCESS" ? (
      <Notice tone="error">
        Đơn đã hủy nhưng VNPay đã ghi nhận khoản thanh toán. Vui lòng liên hệ
        cửa hàng để được hoàn tiền.
      </Notice>
    ) : (
      <Notice tone="error">Thanh toán không thành công, đơn đã hủy.</Notice>
    )
  }

  return <Notice tone="success">Thanh toán VNPay thành công.</Notice>
}

export function OrderDetailPage() {
  const { id: rawId } = useParams()
  const id = parseId(rawId)
  const order = useOrder(id)
  const check = useCheckPayment()
  const cancel = useCancelOrder()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cooldown, startCooldown] = useCooldown(CHECK_COOLDOWN_S)
  const now = useNow()
  const state = useLocation().state as { justPlaced?: boolean } | null
  const [sp] = useSearchParams()

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
  const vnpay = o.paymentMethod === "VNPAY"
  const expiresAt = o.paymentExpiresAt
    ? new Date(o.paymentExpiresAt).getTime()
    : null
  //đơn VNPay chỉ hủy được sau khi URL hết hạn; COD PENDING hủy ngay.
  const canCancel =
    o.status === "PENDING" &&
    (!vnpay || (expiresAt !== null && now >= expiresAt))

  async function checkNow() {
    startCooldown() // giãn ngay khi bấm, kể cả khi lỗi
    try {
      const next = await check.mutateAsync(o.id)
      if (next.status === "PAID") toast.success("Đã xác nhận thanh toán")
      else if (next.status === "CANCELLED")
        toast.error("Thanh toán không thành công, đơn đã hủy")
      else
        toast.info(
          "VNPay chưa ghi nhận thanh toán. Nếu bạn vừa thanh toán, hãy thử lại sau ít giây."
        )
    } catch (error) {
      toast.error(getErrorMessage(error, "Không kiểm tra được thanh toán."))
    }
  }

  return (
    <div className="animate-fade-up space-y-8">
      {state?.justPlaced && !vnpay && (
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

      <PaymentBanner
        order={o}
        hint={sp.get("vnpay")}
        cooldown={cooldown}
        checking={check.isPending}
        onCheck={checkNow}
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="label-mono text-muted-foreground">
            {formatDateTime(o.createdAt)}
          </p>
          <h1 className="text-4xl text-display sm:text-5xl">
            Đơn hàng #{o.id}
          </h1>
        </div>
        <Badge variant={ORDER_STATUS_VARIANT[o.status]}>
          {ORDER_STATUS_LABEL[o.status]}
        </Badge>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
        <OrderItems order={o} />
        <aside className="space-y-6 border border-foreground bg-card p-5">
          <ShippingInfo order={o} />
          <PaymentInfo order={o} />
          {canCancel && (
            <Button
              variant="outline"
              className="w-full text-destructive"
              onClick={() => setCancelOpen(true)}
            >
              Hủy đơn
            </Button>
          )}
          <Button asChild variant="outline" className="w-full">
            <Link to="/orders">Đơn hàng của tôi</Link>
          </Button>
        </aside>
      </div>

      {cancelOpen && (
        <ConfirmDialog
          title={`Hủy đơn #${o.id}?`}
          description="Đơn sẽ bị hủy và số lượng sản phẩm được hoàn về kho. Không thể hoàn tác."
          confirmLabel="Hủy đơn"
          cancelLabel="Giữ đơn"
          onClose={() => setCancelOpen(false)}
          onConfirm={async () => {
            await cancel.mutateAsync(o.id)
            toast.success(`Đã hủy đơn #${o.id}`)
          }}
        />
      )}
    </div>
  )
}
