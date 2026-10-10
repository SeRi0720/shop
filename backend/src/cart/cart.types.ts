export type CartProblem = 'HIDDEN' | 'OUT_OF_STOCK' | 'EXCEEDS_STOCK';

export interface CartLine {
  productId: number;
  name: string;
  price: number; // giá hiện tại của sản phẩm, giỏ không lưu giá
  quantity: number;
  stock: number;
  thumbnailUrl: string | null;
  lineTotal: number;
  problem: CartProblem | null;
}

export interface CartView {
  items: CartLine[];
  totalQuantity: number;
  totalAmount: number;
  hasProblem: boolean;
}
