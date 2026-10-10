export interface CartProductInfo {
  id: number;
  name: string;
  price: number;
  stock: number;
  isActive: boolean;
  thumbnailUrl: string | null;
}

/** Dòng sản phẩm đã bị khóa FOR UPDATE trong transaction. */
export interface LockedProduct {
  id: number;
  name: string;
  price: number;
  stock: number;
  isActive: boolean;
}

export interface StockLine {
  productId: number;
  quantity: number;
}
