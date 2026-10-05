import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  createTaxonomy,
  deleteTaxonomy,
  fetchAdminProducts,
  fetchBrands,
  fetchCategories,
  updateProductActive,
  updateTaxonomy,
} from "./api"
import type { ProductListParams, TaxonomyKind } from "./types"

// Khóa truy vấn gồm toàn bộ tham số lọc: đổi tham số thì ra cache entry khác.
const ADMIN_PRODUCTS = "admin-products"

export function useTaxonomy(kind: TaxonomyKind) {
  return useQuery({
    queryKey: [kind],
    queryFn: kind === "categories" ? fetchCategories : fetchBrands,
  })
}

export function useTaxonomyMutations(kind: TaxonomyKind) {
  const qc = useQueryClient()
  // Đổi tên danh mục/thương hiệu làm đổi cả danh sách sản phẩm đang hiển thị.
  const onSuccess = () => {
    void qc.invalidateQueries({ queryKey: [kind] })
    void qc.invalidateQueries({ queryKey: [ADMIN_PRODUCTS] })
  }
  const create = useMutation({
    mutationFn: (name: string) => createTaxonomy(kind, name),
    onSuccess,
  })
  const update = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      updateTaxonomy(kind, id, name),
    onSuccess,
  })
  const remove = useMutation({
    mutationFn: (id: number) => deleteTaxonomy(kind, id),
    onSuccess,
  })
  return { create, update, remove }
}

export function useAdminProducts(params: ProductListParams) {
  return useQuery({
    queryKey: [ADMIN_PRODUCTS, params],
    queryFn: () => fetchAdminProducts(params),
    placeholderData: keepPreviousData, // giữ dữ liệu trang cũ khi chuyển trang
  })
}

export function useToggleProductActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      updateProductActive(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ADMIN_PRODUCTS] }),
  })
}
