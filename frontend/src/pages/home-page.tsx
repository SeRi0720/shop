import { ArrowRight, PackageSearch } from "lucide-react"
import { Link } from "react-router"
import { APP_NAME } from "@/components/auth/auth-shell"
import { Notice } from "@/components/auth/notice"
import { EmptyState } from "@/components/empty-state"
import { ProductImage } from "@/components/product-image"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useProducts, useTaxonomy } from "@/features/catalog/hooks"
import { ProductCard } from "@/features/catalog/product-card"
import { ProductCardSkeleton } from "@/features/catalog/product-card-skeleton"
import { getErrorMessage } from "@/lib/api"
import { formatPrice } from "@/lib/format"

const LATEST_COUNT = 8

// Lưới có đường kẻ chung: wrapper kẻ trên + trái, mỗi thẻ kẻ phải + dưới.
const GRID_CLASS =
  "grid grid-cols-2 border-t border-l border-foreground md:grid-cols-3 xl:grid-cols-4"

export function HomePage() {
  // Sắp xếp mặc định của backend là "newest", nên không cần truyền sort.
  const latest = useProducts({ page: 1, limit: LATEST_COUNT })
  const categories = useTaxonomy("categories")

  // Sản phẩm mới nhất làm ảnh nổi bật ở banner.
  const featured = latest.data?.items[0]

  let latestContent
  if (latest.isError) {
    latestContent = (
      <div className="space-y-3">
        <Notice tone="error">
          {getErrorMessage(latest.error, "Không tải được sản phẩm.")}
        </Notice>
        <Button variant="outline" onClick={() => latest.refetch()}>
          Thử lại
        </Button>
      </div>
    )
  } else if (latest.isPending) {
    latestContent = (
      <div className={GRID_CLASS}>
        {Array.from({ length: LATEST_COUNT }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    )
  } else if (latest.data.items.length === 0) {
    latestContent = (
      <EmptyState
        icon={PackageSearch}
        title="Chưa có sản phẩm nào"
        description="Cửa hàng đang cập nhật sản phẩm, vui lòng quay lại sau."
      />
    )
  } else {
    latestContent = (
      <div className={GRID_CLASS}>
        {latest.data.items.map((p, i) => (
          <ProductCard key={p.id} product={p} index={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-12">
      {/* Banner kiểu tạp chí: chữ cỡ lớn bên trái, ảnh nổi bật bên phải */}
      <section className="grid border border-foreground lg:grid-cols-[7fr_5fr]">
        <div className="flex flex-col justify-between gap-12 p-6 md:p-10">
          <p className="animate-fade-up label-mono">(01) {APP_NAME}</p>
          <h1
            className="animate-fade-up text-6xl text-display sm:text-8xl lg:text-[7.5rem]"
            style={{ animationDelay: "80ms" }}
          >
            Thiết bị
            <br />
            đáng giữ.
          </h1>
          <div
            className="flex animate-fade-up flex-wrap items-end justify-between gap-6"
            style={{ animationDelay: "160ms" }}
          >
            <p className="max-w-xs text-base leading-relaxed">
              Laptop, điện thoại và phụ kiện công nghệ. Tìm sản phẩm theo nhu
              cầu và mức giá của bạn.
            </p>
            <Button asChild size="lg">
              <Link to="/products">
                Xem tất cả sản phẩm
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>

        <Link
          to={featured ? `/products/${featured.id}` : "/products"}
          className="group flex flex-col gap-3 border-t border-foreground p-4 lg:border-t-0 lg:border-l"
        >
          <div className="flex items-center justify-between label-mono">
            <span>Nổi bật</span>
            <span>01</span>
          </div>
          <div className="relative aspect-[4/5] w-full overflow-hidden border border-foreground bg-muted">
            {latest.isPending ? (
              <Skeleton className="size-full" />
            ) : (
              <ProductImage
                src={featured?.thumbnailUrl}
                alt={featured?.name ?? "Sản phẩm nổi bật"}
                className="size-full"
              />
            )}
            {featured && (
              <span className="absolute top-3 left-3 price-tag tabular-nums">
                {formatPrice(featured.price)}
              </span>
            )}
          </div>
          {featured && (
            <div className="flex items-center justify-between gap-3 label-mono">
              <span className="truncate group-hover:underline">
                {featured.name}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {featured.brand.name}
              </span>
            </div>
          )}
        </Link>
      </section>

      {/* TÙY CHỌN (xóa cả khối này nếu trễ): lối vào theo danh mục */}
      {categories.data && categories.data.length > 0 && (
        <section aria-label="Danh mục" className="space-y-3">
          <p className="label-mono">(02) Danh mục</p>
          <div className="flex flex-wrap gap-2">
            {categories.data.map((c) => (
              <Link
                key={c.id}
                to={`/products?categoryId=${c.id}`}
                className="border border-foreground px-4 py-2.5 label-mono transition-colors hover:bg-foreground hover:text-background"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-6">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-4xl text-display sm:text-6xl">
            Sản phẩm
            <br className="sm:hidden" /> mới nhất
          </h2>
          <Link
            to="/products"
            className="shrink-0 label-mono underline underline-offset-4 hover:no-underline"
          >
            Xem tất cả →
          </Link>
        </div>
        {latestContent}
      </section>
    </div>
  )
}
