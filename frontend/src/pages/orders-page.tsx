import { ReceiptText } from "lucide-react"
import { Link, useSearchParams } from "react-router"
import { Notice } from "@/components/auth/notice"
import { EmptyState } from "@/components/empty-state"
import { SimplePagination } from "@/components/simple-pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useMyOrders } from "@/features/orders/hooks"
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
  PAYMENT_METHOD_SHORT,
  PAYMENT_STATUS_LABEL,
} from "@/features/orders/labels"
import { parseOrderListParams } from "@/features/orders/order-params"
import { getErrorMessage } from "@/lib/api"
import { formatDateTime, formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"

export function OrdersPage() {
  const [sp, setSearchParams] = useSearchParams()
  const list = useMyOrders(parseOrderListParams(sp))

  function goToPage(next: number) {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      p.set("page", String(next))
      return p
    })
  }

  return (
    <div className="animate-fade-up space-y-6">
      <h1 className="text-4xl text-display sm:text-5xl">Đơn hàng của tôi</h1>

      {/* ReturnUrl chuyển về đây khi chữ ký VNPay sai */}
      {sp.get("vnpay") === "invalid" && (
        <Notice tone="error">
          Không xác thực được phản hồi từ VNPay. Nếu bạn đã thanh toán, hãy kiểm
          tra trạng thái đơn bên dưới.
        </Notice>
      )}

      {list.isError ? (
        <div className="space-y-3">
          <Notice tone="error">
            {getErrorMessage(list.error, "Không tải được danh sách đơn hàng.")}
          </Notice>
          <Button variant="outline" onClick={() => list.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : list.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : list.data.items.length === 0 ? (
        list.data.total > 0 ? (
          <EmptyState icon={ReceiptText} title="Trang này không có đơn">
            <Button variant="outline" onClick={() => goToPage(1)}>
              Về trang 1
            </Button>
          </EmptyState>
        ) : (
          <EmptyState
            icon={ReceiptText}
            title="Bạn chưa có đơn hàng nào"
            description="Các đơn bạn đặt sẽ hiện ở đây."
          >
            <Button asChild>
              <Link to="/products">Bắt đầu mua sắm</Link>
            </Button>
          </EmptyState>
        )
      ) : (
        <>
          <ul
            className={cn(
              "space-y-3 transition-opacity",
              list.isPlaceholderData && "opacity-60"
            )}
          >
            {list.data.items.map((o) => (
              <li key={o.id}>
                <Link
                  to={`/orders/${o.id}`}
                  className="block border border-foreground bg-card p-4 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="label-mono text-muted-foreground">
                        {formatDateTime(o.createdAt)}
                      </p>
                      <p className="font-bold">Đơn hàng #{o.id}</p>
                      <p className="line-clamp-1 text-sm">
                        {o.firstItemName ?? "—"}
                        {o.itemCount > 1 && (
                          <span className="text-muted-foreground">
                            {" "}
                            +{o.itemCount - 1} sản phẩm khác
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="space-y-1 text-right">
                      <Badge variant={ORDER_STATUS_VARIANT[o.status]}>
                        {ORDER_STATUS_LABEL[o.status]}
                      </Badge>
                      <p className="price-tag text-lg tabular-nums">
                        {formatPrice(o.totalAmount)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 label-mono text-muted-foreground">
                    {PAYMENT_METHOD_SHORT[o.paymentMethod]} ·{" "}
                    {o.paymentStatus
                      ? PAYMENT_STATUS_LABEL[o.paymentStatus]
                      : "—"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <SimplePagination
            page={list.data.page}
            totalPages={list.data.totalPages}
            summary={`${list.data.total} đơn hàng`}
            onPageChange={goToPage}
          />
        </>
      )}
    </div>
  )
}
