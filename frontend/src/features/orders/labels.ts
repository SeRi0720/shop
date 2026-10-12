import type { OrderStatus, PaymentMethod, PaymentStatus } from "./types"

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Chờ xử lý",
  PAID: "Đã thanh toán",
  SHIPPING: "Đang giao",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  COD: "Thanh toán khi nhận hàng (COD)",
  VNPAY: "VNPay",
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Chờ thanh toán",
  PENDING_ON_DELIVERY: "Thanh toán khi nhận hàng",
  SUCCESS: "Đã thanh toán",
  FAILED: "Không thành công",
}
