import type { QueryClient } from "@tanstack/react-query"
import { PAYMENT_METHOD_SHORT } from "@/features/orders/labels"
import type { PaymentMethod } from "@/features/orders/types"
import { formatPrice } from "@/lib/format"

/** Tên sự kiện socket; phải khớp SOCKET_EVENT ở backend (notification/socket.channel.ts). */
export const NEW_ORDER_EVENT = "notification:new"

export interface NewOrderNotification {
  orderId: number
  totalAmount: number
  paymentMethod: PaymentMethod
}

/** Payload đến từ mạng: kiểm kỹ, sai hình dạng thì bỏ qua (null), không ném lỗi. */
export function parseNewOrder(payload: unknown): NewOrderNotification | null {
  if (typeof payload !== "object" || payload === null) return null
  const { orderId, totalAmount, paymentMethod } = payload as Record<
    string,
    unknown
  >
  if (!Number.isInteger(orderId) || (orderId as number) < 1) return null
  if (!Number.isInteger(totalAmount) || (totalAmount as number) < 0) return null
  if (paymentMethod !== "COD" && paymentMethod !== "VNPAY") return null
  return {
    orderId: orderId as number,
    totalAmount: totalAmount as number,
    paymentMethod,
  }
}

export const newOrderTitle = (n: NewOrderNotification) =>
  `Đơn mới #${n.orderId} (${PAYMENT_METHOD_SHORT[n.paymentMethod]}, ${formatPrice(n.totalAmount)})`

// Đơn VNPay lúc mới tạo chưa thanh toán nên toast nói rõ.
export const newOrderDescription = (n: NewOrderNotification) =>
  n.paymentMethod === "VNPAY" ? "Đang chờ thanh toán VNPay" : undefined

/** Danh sách đơn admin và mọi khối dashboard (khóa ["stats", ...]). */
export function refreshAfterNewOrder(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ["admin-orders"] })
  void qc.invalidateQueries({ queryKey: ["stats"] })
}
