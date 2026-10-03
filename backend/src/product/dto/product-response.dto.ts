import type { ProductWithRelations } from '../product.include';

export class ProductResponseDto {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  specs: Record<string, string>;
  isActive: boolean;
  category: { id: number; name: string };
  brand: { id: number; name: string };
  images: { id: number; url: string; sortOrder: number }[];
  createdAt: Date;
  updatedAt: Date;

  static from(p: ProductWithRelations): ProductResponseDto {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      stock: p.stock,
      specs: p.specs as Record<string, string>,
      isActive: p.isActive,
      category: p.category,
      brand: p.brand,
      images: p.images,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}
