import type { ProductListRow } from '../product.include';

export class ProductListItemDto {
  id: number;
  name: string;
  price: number;
  stock: number;
  isActive: boolean;
  category: { id: number; name: string };
  brand: { id: number; name: string };
  thumbnailUrl: string | null;

  static from(p: ProductListRow): ProductListItemDto {
    return {
      id: p.id,
      name: p.name,
      price: p.price,
      stock: p.stock,
      isActive: p.isActive,
      category: p.category,
      brand: p.brand,
      thumbnailUrl: p.images[0]?.url ?? null,
    };
  }
}

export class ProductListResponseDto {
  items: ProductListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
