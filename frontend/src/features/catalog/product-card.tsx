import { Link } from "react-router"
import { ProductImage } from "@/components/product-image"
import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/format"
import type { ProductListItem } from "./types"

export function ProductCard({
  product,
  index,
}: {
  product: ProductListItem
  index: number
}) {
  return (
    <Link
      to={`/products/${product.id}`}
      className="group flex animate-fade-up flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition duration-200 outline-none hover:-translate-y-1 hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring/50"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        <ProductImage
          src={product.thumbnailUrl}
          alt={product.name}
          className="size-full transition duration-300 group-hover:scale-105"
        />
        {product.stock === 0 && (
          <Badge variant="secondary" className="absolute top-3 left-3">
            Hết hàng
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-xs text-muted-foreground">
          {product.brand.name} · {product.category.name}
        </p>
        <h3 className="line-clamp-2 leading-snug font-medium">
          {product.name}
        </h3>
        <p className="mt-auto pt-2 text-lg font-semibold tabular-nums">
          {formatPrice(product.price)}
        </p>
      </div>
    </Link>
  )
}
