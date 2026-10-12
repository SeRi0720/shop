import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/features/auth/auth-context"
import { invalidateProducts } from "@/features/catalog/hooks"
import { isNotFound } from "@/lib/api"
import { createOrder, fetchOrder } from "./api"

export const orderKey = (userId: number | undefined, id: number | null) =>
  ["order", userId, id] as const

// 404 là kết quả hợp lệ (đơn không tồn tại hoặc không phải của mình), không thử lại.
const retryUnlessNotFound = (failureCount: number, error: unknown) =>
  !isNotFound(error) && failureCount < 2

export function useOrder(id: number | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: orderKey(user?.id, id),
    queryFn: () => fetchOrder(id!),
    enabled: id !== null,
    retry: retryUnlessNotFound,
  })
}

export function useCreateOrder() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: createOrder,
    onSuccess: (order) => {
      // Trang xác nhận có dữ liệu ngay, khỏi chờ gọi lại.
      qc.setQueryData(orderKey(user?.id, order.id), order)
      // Giỏ rỗng và tồn kho vừa đổi.
      void qc.invalidateQueries({ queryKey: ["cart"] })
      void invalidateProducts(qc)
    },
    // Lỗi 409 (hết hàng, giỏ trống): giỏ thật đã đổi, tải lại để giao diện đúng.
    onError: () => {
      void qc.invalidateQueries({ queryKey: ["cart"] })
    },
  })
}
