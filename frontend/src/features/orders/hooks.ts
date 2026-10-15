import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"
import { useAuth } from "@/features/auth/auth-context"
import { invalidateProducts } from "@/features/catalog/hooks"
import { isNotFound } from "@/lib/api"
import {
  cancelOrder,
  changeOrderStatus,
  checkPayment,
  createOrder,
  fetchAdminOrder,
  fetchAdminOrders,
  fetchMyOrders,
  fetchOrder,
} from "./api"
import type {
  AdminOrderListParams,
  AdminTargetStatus,
  OrderListParams,
} from "./types"

// Khóa của người dùng có userId để đổi tài khoản không lẫn cache; khóa admin không cần.
export const orderKey = (userId: number | undefined, id: number | null) =>
  ["order", userId, id] as const

const ORDER_KEYS = ["order", "orders", "admin-order", "admin-orders"]

/** Mọi thao tác đổi đơn: làm mất hiệu lực cache đơn và cả sản phẩm (kho có thể đổi). */
export const invalidateOrders = (qc: QueryClient) =>
  Promise.all([
    ...ORDER_KEYS.map((key) => qc.invalidateQueries({ queryKey: [key] })),
    invalidateProducts(qc),
  ])

// 404 là kết quả hợp lệ (đơn không tồn tại hoặc không phải của mình), không thử lại.
const retryUnlessNotFound = (failureCount: number, error: unknown) =>
  !isNotFound(error) && failureCount < 2

// ---- Người dùng ----
export function useOrder(id: number | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: orderKey(user?.id, id),
    queryFn: () => fetchOrder(id!),
    enabled: id !== null,
    retry: retryUnlessNotFound,
  })
}

export function useMyOrders(params: OrderListParams) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["orders", user?.id, params],
    queryFn: () => fetchMyOrders(params),
    placeholderData: keepPreviousData,
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
      // Giỏ rỗng, tồn kho vừa đổi, và danh sách đơn có thêm một dòng mới.
      void qc.invalidateQueries({ queryKey: ["cart"] })
      void qc.invalidateQueries({ queryKey: ["orders"] })
      void invalidateProducts(qc)
    },
    // Lỗi 409 (hết hàng, giỏ trống): giỏ thật đã đổi, tải lại để giao diện đúng.
    onError: () => {
      void qc.invalidateQueries({ queryKey: ["cart"] })
    },
  })
}

export function useCancelOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: cancelOrder,
    onSuccess: () => invalidateOrders(qc),
  })
}

export function useCheckPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: checkPayment,
    onSuccess: () => invalidateOrders(qc),
  })
}

// ---- Admin ----
export function useAdminOrders(params: AdminOrderListParams) {
  return useQuery({
    queryKey: ["admin-orders", params],
    queryFn: () => fetchAdminOrders(params),
    placeholderData: keepPreviousData,
  })
}

export function useAdminOrder(id: number | null) {
  return useQuery({
    queryKey: ["admin-order", id],
    queryFn: () => fetchAdminOrder(id!),
    enabled: id !== null,
    retry: retryUnlessNotFound,
  })
}

export function useChangeOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: AdminTargetStatus }) =>
      changeOrderStatus(id, status),
    onSuccess: () => invalidateOrders(qc),
  })
}
