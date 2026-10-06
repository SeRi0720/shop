import { api } from "@/lib/api"
import type {
  NamedItem,
  ProductDetail,
  ProductImage,
  ProductInput,
  ProductListParams,
  ProductListResponse,
  TaxonomyKind,
} from "./types"

export const fetchCategories = () =>
  api.get<NamedItem[]>("/categories").then((r) => r.data)
export const fetchBrands = () =>
  api.get<NamedItem[]>("/brands").then((r) => r.data)

export const createTaxonomy = (kind: TaxonomyKind, name: string) =>
  api.post<NamedItem>(`/admin/${kind}`, { name }).then((r) => r.data)
export const updateTaxonomy = (kind: TaxonomyKind, id: number, name: string) =>
  api.patch<NamedItem>(`/admin/${kind}/${id}`, { name }).then((r) => r.data)
export const deleteTaxonomy = (kind: TaxonomyKind, id: number) =>
  api.delete(`/admin/${kind}/${id}`)

// ---- Admin: sản phẩm ----
export const fetchAdminProducts = (params: ProductListParams) =>
  api
    .get<ProductListResponse>("/admin/products", { params })
    .then((r) => r.data)
export const fetchAdminProduct = (id: number) =>
  api.get<ProductDetail>(`/admin/products/${id}`).then((r) => r.data)
export const createProduct = (input: ProductInput) =>
  api.post<ProductDetail>("/admin/products", input).then((r) => r.data)
export const updateProduct = (id: number, input: ProductInput) =>
  api.patch<ProductDetail>(`/admin/products/${id}`, input).then((r) => r.data)
export const updateProductActive = (id: number, isActive: boolean) =>
  api.patch(`/admin/products/${id}`, { isActive })

// Không tự đặt Content-Type: để trình duyệt sinh kèm boundary cho multipart.
export const uploadProductImages = (id: number, files: File[]) => {
  const body = new FormData()
  files.forEach((file) => body.append("files", file)) // tên trường khớp FilesInterceptor('files')
  return api
    .post<ProductImage[]>(`/admin/products/${id}/images`, body)
    .then((r) => r.data)
}
export const deleteProductImage = (id: number, imageId: number) =>
  api.delete(`/admin/products/${id}/images/${imageId}`)

// ---- Công khai (khách) ----
export const fetchProducts = (params: ProductListParams) =>
  api.get<ProductListResponse>("/products", { params }).then((r) => r.data)
export const fetchProduct = (id: number) =>
  api.get<ProductDetail>(`/products/${id}`).then((r) => r.data)
