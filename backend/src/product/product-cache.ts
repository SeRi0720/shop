import { createHash } from 'node:crypto';
import type { ProductQueryDto } from './dto/product-query.dto';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 12;

/** Giây. Giá trị tạm, tuần 13 đo lại. */
export const CATALOG_TTL = { list: 60, detail: 60, taxonomy: 300 } as const;

export const CATEGORIES_SCOPE = 'categories';
export const BRANDS_SCOPE = 'brands';
export const productScope = (id: number) => `product:${id}`;

export function productListScope(query: ProductQueryDto): string {
  // Hình dạng cố định, khóa theo thứ tự chữ cái; JSON.stringify bỏ undefined.
  // Mặc định (page, limit, sort) được điền để ?page=1 và không có page ra cùng khóa.
  const normalized = {
    brandId: query.brandId,
    categoryId: query.categoryId,
    limit: query.limit ?? DEFAULT_LIMIT,
    maxPrice: query.maxPrice,
    minPrice: query.minPrice,
    page: query.page ?? DEFAULT_PAGE,
    q: query.q?.trim() || undefined,
    sort: query.sort ?? 'newest',
  };
  const hash = createHash('sha1')
    .update(JSON.stringify(normalized))
    .digest('hex');
  return `products:${hash}`;
}
