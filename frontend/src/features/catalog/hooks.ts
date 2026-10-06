import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"
import { isNotFound } from "@/lib/api"
import {
  createProduct,
  createTaxonomy,
  deleteProductImage,
  deleteTaxonomy,
  fetchAdminProduct,
  fetchAdminProducts,
  fetchBrands,
  fetchCategories,
  fetchProduct,
  fetchProducts,
  updateProduct,
  updateProductActive,
  updateTaxonomy,
  uploadProductImages,
} from "./api"
import type { ProductInput, ProductListParams, TaxonomyKind } from "./types"

// Khóa truy vấn luôn gồm toàn bộ tham số; admin và khách dùng khóa riêng.
const ADMIN_PRODUCTS = "admin-products"
const PRODUCT_KEYS = [ADMIN_PRODUCTS, "admin-product", "products", "product"]

// Admin đổi dữ liệu thì làm mất hiệu lực cả bốn nhóm cache liên quan.
const invalidateProducts = (qc: QueryClient) =>
  Promise.all(
    PRODUCT_KEYS.map((key) => qc.invalidateQueries({ queryKey: [key] }))
  )

// 404 là kết quả hợp lệ (sản phẩm không tồn tại/đang ẩn), không thử lại.
const retryUnlessNotFound = (failureCount: number, error: unknown) =>
  !isNotFound(error) && failureCount < 2

// ---- Danh mục & thương hiệu ----
export function useTaxonomy(kind: TaxonomyKind) {
  return useQuery({
    queryKey: [kind],
    queryFn: kind === "categories" ? fetchCategories : fetchBrands,
  })
}

export function useTaxonomyMutations(kind: TaxonomyKind) {
  const qc = useQueryClient()
  const onSuccess = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: [kind] }),
      invalidateProducts(qc),
    ])
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

// ---- Admin: sản phẩm ----
export function useAdminProducts(params: ProductListParams) {
  return useQuery({
    queryKey: [ADMIN_PRODUCTS, params],
    queryFn: () => fetchAdminProducts(params),
    placeholderData: keepPreviousData,
  })
}

export function useAdminProduct(id: number | null) {
  return useQuery({
    queryKey: ["admin-product", id],
    queryFn: () => fetchAdminProduct(id!),
    enabled: id !== null,
    retry: retryUnlessNotFound,
  })
}

export function useToggleProductActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      updateProductActive(id, isActive),
    onSuccess: () => invalidateProducts(qc),
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ProductInput) => createProduct(input),
    onSuccess: () => invalidateProducts(qc),
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ProductInput }) =>
      updateProduct(id, input),
    onSuccess: () => invalidateProducts(qc),
  })
}

export function useUploadImages(productId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (files: File[]) => uploadProductImages(productId, files),
    onSuccess: () => invalidateProducts(qc),
  })
}

export function useDeleteImage(productId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (imageId: number) => deleteProductImage(productId, imageId),
    onSuccess: () => invalidateProducts(qc),
  })
}

// ---- Khách ----
export function useProducts(params: ProductListParams) {
  return useQuery({
    queryKey: ["products", params],
    queryFn: () => fetchProducts(params),
    placeholderData: keepPreviousData,
  })
}

export function useProduct(id: number | null) {
  return useQuery({
    queryKey: ["product", id],
    queryFn: () => fetchProduct(id!),
    enabled: id !== null,
    retry: retryUnlessNotFound,
  })
}
