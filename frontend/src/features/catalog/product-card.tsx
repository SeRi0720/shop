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
      className="group flex animate-fade-up flex-col gap-4 border-r border-b border-foreground bg-card p-4 transition-colors outline-none hover:bg-foreground hover:text-background focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="flex items-center justify-between gap-2 label-mono">
        <span>{String(index + 1).padStart(2, "0")}</span>
        <span className="truncate">{product.category.name}</span>
      </div>

      <div className="relative aspect-square overflow-hidden border border-current bg-muted">
        <ProductImage
          src={product.thumbnailUrl}
          alt={product.name}
          className="size-full"
        />
        {product.stock === 0 && (
          <Badge variant="secondary" className="absolute top-2 left-2">
            Hết hàng
          </Badge>
        )}
      </div>

      <h3 className="line-clamp-2 text-lg leading-snug font-bold">
        {product.name}
      </h3>

      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="truncate label-mono text-muted-foreground group-hover:text-background/70">
          {product.brand.name}
        </span>
        <span className="shrink-0 price-tag tabular-nums">
          {formatPrice(product.price)}
        </span>
      </div>
    </Link>
  )
}
