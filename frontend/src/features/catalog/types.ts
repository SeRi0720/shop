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

export interface ProductImage {
  id: number
  url: string
  sortOrder: number
}
export interface ProductDetail {
  id: number
  name: string
  description: string | null
  price: number
  stock: number
  specs: Record<string, string>
  isActive: boolean
  category: NamedItem
  brand: NamedItem
  images: ProductImage[]
  createdAt: string
  updatedAt: string
}
export interface ProductInput {
  name: string
  description: string
  price: number
  stock: number
  categoryId: number
  brandId: number
  specs: Record<string, string>
}
