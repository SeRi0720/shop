import type { ProductListParams, ProductSort } from "./types"

export const PRODUCT_PAGE_SIZE = 12
const SORTS: ProductSort[] = ["newest", "price_asc", "price_desc"]
const MAX_PAGE = 100000 // khớp ProductQueryDto
const MAX_PRICE = 2_000_000_000
const MAX_ID = 2_147_483_647

function toInt(
  raw: string | null,
  min: number,
  max: number
): number | undefined {
  const s = raw?.trim()
  if (!s || !/^\d+$/.test(s)) return undefined
  const n = Number(s)
  return n >= min && n <= max ? n : undefined
}

/** Tham số rỗng/sai thì bỏ hoặc dùng mặc định; `limit` luôn cố định, bỏ qua giá trị trên URL. */
export function parseProductParams(sp: URLSearchParams): ProductListParams {
  let minPrice = toInt(sp.get("minPrice"), 0, MAX_PRICE)
  let maxPrice = toInt(sp.get("maxPrice"), 0, MAX_PRICE)
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    ;[minPrice, maxPrice] = [maxPrice, minPrice] // backend từ chối min > max
  }
  const sort = sp.get("sort") as ProductSort | null
  return {
    q: sp.get("q")?.trim().slice(0, 100) || undefined,
    categoryId: toInt(sp.get("categoryId"), 1, MAX_ID),
    brandId: toInt(sp.get("brandId"), 1, MAX_ID),
    minPrice,
    maxPrice,
    sort: sort && sort !== "newest" && SORTS.includes(sort) ? sort : undefined,
    page: toInt(sp.get("page"), 1, MAX_PAGE) ?? 1,
    limit: PRODUCT_PAGE_SIZE,
  }
}
