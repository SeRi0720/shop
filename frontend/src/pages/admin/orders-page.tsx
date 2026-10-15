import { TriangleAlert } from "lucide-react"
import { useSearchParams } from "react-router"
import { Notice } from "@/components/auth/notice"
import { SimplePagination } from "@/components/simple-pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AdminOrderFilters } from "@/features/orders/admin-order-filters"
import { useAdminOrders } from "@/features/orders/hooks"
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
  PAYMENT_METHOD_SHORT,
  PAYMENT_STATUS_LABEL,
} from "@/features/orders/labels"
import { parseAdminOrderParams } from "@/features/orders/order-params"
import { getErrorMessage } from "@/lib/api"
import { formatDateTime, formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"

const COLUMN_COUNT = 7 // Mã, Thời gian, Người nhận, Sản phẩm, Thanh toán, Trạng thái, Tổng tiền
const FILTER_KEYS = ["q", "status", "paymentMethod", "from", "to"]

export function AdminOrdersPage() {
  const [sp, setSearchParams] = useSearchParams()
  const params = parseAdminOrderParams(sp)
  const list = useAdminOrders(params)
  const hasFilters = FILTER_KEYS.some((key) => sp.has(key))

  function goToPage(next: number) {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      p.set("page", String(next))
      return p
    })
  }

  return (
    <div className="animate-fade-up space-y-6">
      <div className="space-y-1">
        <h1 className="text-4xl text-display">Đơn hàng</h1>
        <p className="text-sm text-muted-foreground">
          Mọi đơn của khách. Bộ lọc nằm trên URL nên có thể sao chép để chia sẻ.
        </p>
      </div>

      <AdminOrderFilters />

      {list.isError ? (
        <div className="space-y-3">
          <Notice tone="error">
            {getErrorMessage(list.error, "Không tải được danh sách đơn hàng.")}
          </Notice>
          <Button variant="outline" onClick={() => list.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : (
        <>
          <div
            className={cn(
              "overflow-x-auto border border-foreground bg-card transition-opacity",
              list.isPlaceholderData && "opacity-60"
            )}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Mã</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Người nhận</TableHead>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead>Thanh toán</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Tổng tiền</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.isPending &&
                  Array.from({ length: 5 }, (_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: COLUMN_COUNT }, (_, c) => (
                        <TableCell key={c}>
                          <Skeleton className="h-4 w-full max-w-32" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                {list.data?.items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={COLUMN_COUNT}
                      className="py-12 text-center text-muted-foreground"
                    >
                      {list.data.total > 0 ? (
                        <>
                          Trang này không có đơn.{" "}
                          <Button
                            variant="link"
                            className="h-auto p-0"
                            onClick={() => goToPage(1)}
                          >
                            Về trang 1
                          </Button>
                        </>
                      ) : hasFilters ? (
                        "Không có đơn nào khớp bộ lọc."
                      ) : (
                        "Chưa có đơn hàng nào."
                      )}
                    </TableCell>
                  </TableRow>
                )}

                {list.data?.items.map((o) => {
                  const needsRefund =
                    o.status === "CANCELLED" && o.paymentStatus === "SUCCESS"
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-bold tabular-nums">
                        #{o.id}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatDateTime(o.createdAt)}
                      </TableCell>
                      <TableCell>
                        <p className="font-bold">{o.shippingName}</p>
                        <p className="label-mono text-muted-foreground">
                          {o.shippingPhone}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="max-w-56 truncate">
                          {o.firstItemName ?? "—"}
                        </p>
                        {o.itemCount > 1 && (
                          <p className="label-mono text-muted-foreground">
                            +{o.itemCount - 1} sản phẩm khác
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <p>{PAYMENT_METHOD_SHORT[o.paymentMethod]}</p>
                        <p className="label-mono text-muted-foreground">
                          {o.paymentStatus
                            ? PAYMENT_STATUS_LABEL[o.paymentStatus]
                            : "—"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ORDER_STATUS_VARIANT[o.status]}>
                          {ORDER_STATUS_LABEL[o.status]}
                        </Badge>
                        {needsRefund && (
                          <p className="mt-1 flex items-center gap-1 label-mono text-destructive">
                            <TriangleAlert aria-hidden className="size-3" />
                            Đã thu tiền, cần hoàn
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPrice(o.totalAmount)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {list.data && (
            <SimplePagination
              page={list.data.page}
              totalPages={list.data.totalPages}
              summary={`${list.data.total} đơn hàng`}
              onPageChange={goToPage}
            />
          )}
        </>
      )}
    </div>
  )
}
