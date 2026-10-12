import { api } from "@/lib/api"
import type { CreateOrderInput, Order } from "./types"

export const createOrder = (input: CreateOrderInput) =>
  api.post<Order>("/orders", input).then((r) => r.data)

export const fetchOrder = (id: number) =>
  api.get<Order>(`/orders/${id}`).then((r) => r.data)
