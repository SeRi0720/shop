import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/features/auth/auth-context"
import {
  addCartItem,
  fetchCart,
  removeCartItem,
  setCartItemQuantity,
} from "./api"
import type { Cart } from "./types"

// Khóa theo userId: đổi người đăng nhập thì không thấy giỏ của người trước.
export const cartKey = (userId: number | undefined) => ["cart", userId] as const

export function useCart() {
  const { status, user } = useAuth()
  return useQuery({
    queryKey: cartKey(user?.id),
    queryFn: fetchCart,
    enabled: status === "authenticated",
  })
}

export function useCartMutations() {
  const qc = useQueryClient()
  const { user } = useAuth()
  // Backend trả cả giỏ sau mỗi thao tác: ghi thẳng vào cache, đỡ một lượt gọi lại.
  const onSuccess = (cart: Cart) => qc.setQueryData(cartKey(user?.id), cart)

  const add = useMutation({
    mutationFn: ({
      productId,
      quantity,
    }: {
      productId: number
      quantity: number
    }) => addCartItem(productId, quantity),
    onSuccess,
  })
  const setQuantity = useMutation({
    mutationFn: ({
      productId,
      quantity,
    }: {
      productId: number
      quantity: number
    }) => setCartItemQuantity(productId, quantity),
    onSuccess,
  })
  const remove = useMutation({
    mutationFn: (productId: number) => removeCartItem(productId),
    onSuccess,
  })
  return { add, setQuantity, remove }
}
