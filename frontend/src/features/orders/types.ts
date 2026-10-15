export type OrderStatus =
  "PENDING" | "PAID" | "SHIPPING" | "COMPLETED" | "CANCELLED"
export type PaymentMethod = "COD" | "VNPAY"
export type PaymentStatus =
  "PENDING" | "PENDING_ON_DELIVERY" | "SUCCESS" | "FAILED"
export type AdminTargetStatus = "SHIPPING" | "COMPLETED" | "CANCELLED"

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
  paymentUrl?: string
  paymentExpiresAt?: string | null
}

export interface CreateOrderInput {
  shippingName: string
  shippingPhone: string
  shippingAddress: string
  note?: string
  paymentMethod: PaymentMethod
}

export interface StockShortage {
  productId: number
  name: string
  requested: number
  available: number
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface OrderListItem {
  id: number
  createdAt: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus | null
  totalAmount: number
  itemCount: number
  firstItemName: string | null
}

export interface AdminOrderListItem extends OrderListItem {
  shippingName: string
  shippingPhone: string
  nextStatuses: AdminTargetStatus[]
}

export interface AdminOrder extends Order {
  nextStatuses: AdminTargetStatus[]
}

export interface OrderListParams {
  page: number
  limit: number
}

export interface AdminOrderListParams extends OrderListParams {
  status?: OrderStatus
  paymentMethod?: PaymentMethod
  q?: string
  from?: string // yyyy-MM-dd, giờ VN
  to?: string
}
