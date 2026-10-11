import { api } from "@/lib/api"
import type { Cart } from "./types"

export const fetchCart = () => api.get<Cart>("/cart").then((r) => r.data)

export const addCartItem = (productId: number, quantity: number) =>
  api.post<Cart>("/cart/items", { productId, quantity }).then((r) => r.data)

export const setCartItemQuantity = (productId: number, quantity: number) =>
  api.patch<Cart>(`/cart/items/${productId}`, { quantity }).then((r) => r.data)

export const removeCartItem = (productId: number) =>
  api.delete<Cart>(`/cart/items/${productId}`).then((r) => r.data)
