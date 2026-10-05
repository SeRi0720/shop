import { api } from "@/lib/api"
import type {
  NamedItem,
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

// axios bỏ qua tham số có giá trị undefined, nên không cần lọc thủ công.
export const fetchAdminProducts = (params: ProductListParams) =>
  api
    .get<ProductListResponse>("/admin/products", { params })
    .then((r) => r.data)

export const updateProductActive = (id: number, isActive: boolean) =>
  api.patch(`/admin/products/${id}`, { isActive })
