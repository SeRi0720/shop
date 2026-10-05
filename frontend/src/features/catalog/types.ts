export interface NamedItem {
  id: number
  name: string
}
export type TaxonomyKind = "categories" | "brands"
export type ProductSort = "newest" | "price_asc" | "price_desc"

export interface ProductListItem {
  id: number
  name: string
  price: number
  stock: number
  isActive: boolean
  category: NamedItem
  brand: NamedItem
  thumbnailUrl: string | null
}
export interface ProductListResponse {
  items: ProductListItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}
export interface ProductListParams {
  q?: string
  categoryId?: number
  brandId?: number
  minPrice?: number
  maxPrice?: number
  sort?: ProductSort
  page?: number
  limit?: number
}
