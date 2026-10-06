import { useState } from "react"
import { PackageX, ShoppingCart } from "lucide-react"
import { Link, useParams } from "react-router"
import { Notice } from "@/components/auth/notice"
import { EmptyState } from "@/components/empty-state"
import { ProductImage } from "@/components/product-image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { useProduct } from "@/features/catalog/hooks"
import { getErrorMessage, isNotFound } from "@/lib/api"
import { formatPrice } from "@/lib/format"
import { parseId } from "@/lib/parse-id"
import { cn } from "@/lib/utils"

function NotFound() {
  return (
    <EmptyState
      icon={PackageX}
      title="Không tìm thấy sản phẩm"
      description="Sản phẩm không tồn tại hoặc đã ngừng bán."
    >
      <Button asChild variant="outline">
        <Link to="/products">Xem các sản phẩm khác</Link>
      </Button>
    </EmptyState>
  )
}

function DetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Skeleton className="aspect-square w-full rounded-2xl" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  )
}

export function ProductDetailPage() {
  const { id: rawId } = useParams()
  const id = parseId(rawId)
  const product = useProduct(id)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  if (id === null || isNotFound(product.error)) return <NotFound />
  if (product.isPending) return <DetailSkeleton />
  if (product.isError) {
    return (
      <div className="space-y-3">
        <Notice tone="error">
          {getErrorMessage(product.error, "Không tải được sản phẩm.")}
        </Notice>
        <Button variant="outline" onClick={() => product.refetch()}>
          Thử lại
        </Button>
      </div>
    )
  }

  const p = product.data
  const current = p.images.find((img) => img.id === selectedId) ?? p.images[0]
  const specEntries = Object.entries(p.specs)

  return (
    <div className="animate-fade-up space-y-10">
      <nav aria-label="Đường dẫn" className="text-sm text-muted-foreground">
        <Link to="/products" className="hover:text-foreground">
          Sản phẩm
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{p.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <ProductImage
              src={current?.url}
              alt={p.name}
              className="aspect-square w-full"
            />
          </div>
          {p.images.length > 1 && (
            <ul className="grid grid-cols-5 gap-2 sm:grid-cols-6">
              {p.images.map((img, i) => (
                <li key={img.id}>
                  <button
                    type="button"
                    aria-label={`Xem ảnh ${i + 1}`}
                    aria-current={img.id === current?.id}
                    onClick={() => setSelectedId(img.id)}
                    className={cn(
                      "block w-full overflow-hidden rounded-lg border-2 transition duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      img.id === current?.id
                        ? "border-brand-from"
                        : "border-transparent opacity-70 hover:opacity-100"
                    )}
                  >
                    <ProductImage
                      src={img.url}
                      alt=""
                      className="aspect-square w-full"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {p.brand.name} · {p.category.name}
          </p>
          <h1 className="text-3xl leading-tight font-semibold tracking-tight">
            {p.name}
          </h1>
          <p className="text-3xl font-semibold tabular-nums">
            {formatPrice(p.price)}
          </p>
          <div>
            {p.stock > 0 ? (
              <Badge variant="secondary">Còn {p.stock} sản phẩm</Badge>
            ) : (
              <Badge variant="outline">Hết hàng</Badge>
            )}
          </div>
          {/* React tự escape nội dung; không dùng dangerouslySetInnerHTML */}
          {p.description && (
            <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
              {p.description}
            </p>
          )}
          <div className="space-y-2 pt-2">
            <Button
              size="lg"
              disabled
              className="h-11 w-full sm:w-auto sm:px-8"
            >
              <ShoppingCart />
              Thêm vào giỏ
            </Button>
            <p className="text-xs text-muted-foreground">
              Chức năng giỏ hàng sẽ có ở bản cập nhật tới.
            </p>
          </div>
        </div>
      </div>

      {specEntries.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Thông số kỹ thuật</h2>
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableBody>
                {specEntries.map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell className="w-1/3 font-medium text-muted-foreground">
                      {key}
                    </TableCell>
                    <TableCell>{value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  )
}
