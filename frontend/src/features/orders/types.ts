export type OrderStatus =
  "PENDING" | "PAID" | "SHIPPING" | "COMPLETED" | "CANCELLED"
export type PaymentMethod = "COD" | "VNPAY"
export type PaymentStatus =
  "PENDING" | "PENDING_ON_DELIVERY" | "SUCCESS" | "FAILED"

export interface OrderLine {
  productId: number
  productName: string
  unitPrice: number
  quantity: number
  lineTotal: number
}

export interface Order {
  id: number
  status: OrderStatus
  totalAmount: number
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus | null
  shippingName: string
  shippingPhone: string
  shippingAddress: string
  note: string | null
  createdAt: string
  items: OrderLine[]
}

export interface CreateOrderInput {
  shippingName: string
  shippingPhone: string
  shippingAddress: string
  note?: string
  paymentMethod: "COD" // tuần 5 mới thêm VNPAY
}

export interface StockShortage {
  productId: number
  name: string
  requested: number
  available: number
}
