import { useState } from "react"
import { ArrowLeft, Loader2, PackageX } from "lucide-react"
import { Link, useLocation, useParams } from "react-router"
import { toast } from "sonner"
import { Notice } from "@/components/auth/notice"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useAdminOrder,
  useChangeOrderStatus,
  useCheckPayment,
} from "@/features/orders/hooks"
import {
  ADMIN_ACTION_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
} from "@/features/orders/labels"
import {
  OrderItems,
  PaymentInfo,
  ShippingInfo,
} from "@/features/orders/order-parts"
import type { AdminTargetStatus } from "@/features/orders/types"
import { getErrorMessage, isNotFound } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { parseId } from "@/lib/parse-id"
import { useCooldown } from "@/lib/use-cooldown"

export function AdminOrderDetailPage() {
  const { id: rawId } = useParams()
  const id = parseId(rawId)
  const order = useAdminOrder(id)
  const change = useChangeOrderStatus()
  const check = useCheckPayment()
  const [cooldown, startCooldown] = useCooldown(10)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const from = (useLocation().state as { search?: string } | null)?.search ?? ""

  const back = (
    <Button asChild variant="ghost" size="sm">
      <Link to={{ pathname: "/admin/orders", search: from }}>
        <ArrowLeft />
        Danh sách đơn
      </Link>
    </Button>
  )

  if (id === null || isNotFound(order.error)) {
    return (
      <EmptyState icon={PackageX} title="Không tìm thấy đơn hàng">
        {back}
      </EmptyState>
    )
  }
  if (order.isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }
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
  const lateCharged = o.status === "CANCELLED" && o.paymentStatus === "SUCCESS"
  const waitingVnpay = o.paymentMethod === "VNPAY" && o.status === "PENDING"

  async function move(status: AdminTargetStatus) {
    try {
      await change.mutateAsync({ id: o.id, status })
      toast.success(
        `Đã chuyển đơn #${o.id} sang “${ORDER_STATUS_LABEL[status]}”`
      )
    } catch (error) {
      toast.error(getErrorMessage(error, "Không đổi được trạng thái."))
    }
  }

  async function checkNow() {
    startCooldown()
    try {
      const next = await check.mutateAsync(o.id)
      if (next.status === "PENDING")
        toast.info("VNPay chưa ghi nhận thanh toán.")
      else
        toast.success(
          `Đã đồng bộ với VNPay: ${ORDER_STATUS_LABEL[next.status]}`
        )
    } catch (error) {
      toast.error(getErrorMessage(error, "Không kiểm tra được thanh toán."))
    }
  }

  return (
    <div className="animate-fade-up space-y-6">
      {back}

      {lateCharged && (
        <Notice tone="error">
          Đơn đã hủy nhưng VNPay đã thu tiền. Hệ thống không tự hoàn tiền, cần
          hoàn tiền thủ công cho khách.
        </Notice>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="label-mono text-muted-foreground">
            {formatDateTime(o.createdAt)}
          </p>
          <h1 className="text-4xl text-display">Đơn hàng #{o.id}</h1>
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

          <div className="space-y-2">
            <h2 className="label-mono">Thao tác</h2>
            {o.nextStatuses.map((status) => (
              <Button
                key={status}
                variant={status === "CANCELLED" ? "outline" : "default"}
                className={
                  status === "CANCELLED" ? "w-full text-destructive" : "w-full"
                }
                disabled={change.isPending}
                onClick={() =>
                  status === "CANCELLED" ? setConfirmCancel(true) : move(status)
                }
              >
                {change.isPending && change.variables?.status === status && (
                  <Loader2 className="animate-spin" />
                )}
                {ADMIN_ACTION_LABEL[status]}
              </Button>
            ))}
            {o.nextStatuses.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {waitingVnpay
                  ? "Đang chờ khách thanh toán qua VNPay. Quá hạn thanh toán mà chưa trả tiền thì đơn tự hủy."
                  : "Đơn ở trạng thái cuối, không còn thao tác."}
              </p>
            )}
            {waitingVnpay && (
              <Button
                variant="outline"
                className="w-full"
                disabled={check.isPending || cooldown > 0}
                onClick={checkNow}
              >
                {check.isPending && <Loader2 className="animate-spin" />}
                {cooldown > 0
                  ? `Kiểm tra thanh toán (${cooldown}s)`
                  : "Kiểm tra thanh toán"}
              </Button>
            )}
          </div>
        </aside>
      </div>

      {confirmCancel && (
        <ConfirmDialog
          title={`Hủy đơn #${o.id}?`}
          description={
            "Hủy đơn sẽ hoàn tồn kho cho các sản phẩm trong đơn. Hệ thống không tự hoàn tiền." +
            (o.paymentStatus === "SUCCESS"
              ? " Khách đã thanh toán, bạn cần hoàn tiền thủ công."
              : "")
          }
          confirmLabel="Hủy đơn"
          cancelLabel="Giữ đơn"
          onClose={() => setConfirmCancel(false)}
          onConfirm={async () => {
            await change.mutateAsync({ id: o.id, status: "CANCELLED" })
            toast.success(`Đã hủy đơn #${o.id}`)
          }}
        />
      )}
    </div>
  )
}
