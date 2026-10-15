import { api } from "@/lib/api"
import type {
  AdminOrder,
  AdminOrderListItem,
  AdminOrderListParams,
  AdminTargetStatus,
  CreateOrderInput,
  Order,
  OrderListItem,
  OrderListParams,
  Paginated,
} from "./types"

export const createOrder = (input: CreateOrderInput) =>
  api.post<Order>("/orders", input).then((r) => r.data)
export const fetchOrder = (id: number) =>
  api.get<Order>(`/orders/${id}`).then((r) => r.data)

export const fetchMyOrders = (params: OrderListParams) =>
  api.get<Paginated<OrderListItem>>("/orders", { params }).then((r) => r.data)
export const cancelOrder = (id: number) =>
  api.post<Order>(`/orders/${id}/cancel`).then((r) => r.data)
export const checkPayment = (id: number) =>
  api.post<Order>(`/orders/${id}/check-payment`).then((r) => r.data)

// ---- Admin ----
export const fetchAdminOrders = (params: AdminOrderListParams) =>
  api
    .get<Paginated<AdminOrderListItem>>("/admin/orders", { params })
    .then((r) => r.data)
export const fetchAdminOrder = (id: number) =>
  api.get<AdminOrder>(`/admin/orders/${id}`).then((r) => r.data)
export const changeOrderStatus = (id: number, status: AdminTargetStatus) =>
  api.patch<Order>(`/admin/orders/${id}/status`, { status }).then((r) => r.data)
