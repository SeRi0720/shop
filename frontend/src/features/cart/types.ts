export type CartProblem = "HIDDEN" | "OUT_OF_STOCK" | "EXCEEDS_STOCK"

export interface CartLine {
  productId: number
  name: string
  price: number
  quantity: number
  stock: number
  thumbnailUrl: string | null
  lineTotal: number
  problem: CartProblem | null
}

export interface Cart {
  items: CartLine[]
  totalQuantity: number
  totalAmount: number
  hasProblem: boolean
}
