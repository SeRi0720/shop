import { ArrowRight, PackageSearch } from "lucide-react"
import { Link } from "react-router"
import { APP_NAME } from "@/components/auth/auth-shell"
import { Notice } from "@/components/auth/notice"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { useProducts, useTaxonomy } from "@/features/catalog/hooks"
import { ProductCard } from "@/features/catalog/product-card"
import { ProductCardSkeleton } from "@/features/catalog/product-card-skeleton"
import { getErrorMessage } from "@/lib/api"

const LATEST_COUNT = 8

export function HomePage() {
  // Sắp xếp mặc định của backend là "newest", nên không cần truyền sort.
  const latest = useProducts({ page: 1, limit: LATEST_COUNT })
  const categories = useTaxonomy("categories")

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
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
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
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {latest.data.items.map((p, i) => (
          <ProductCard key={p.id} product={p} index={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {/* Banner: lớp trang trí có aria-hidden + pointer-events-none để không chặn click */}
      <section className="relative overflow-hidden rounded-3xl bg-neutral-950 px-6 py-12 text-white md:px-12 md:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(60%_50%_at_15%_10%,var(--brand-from),transparent_70%),radial-gradient(50%_45%_at_90%_95%,var(--brand-to),transparent_70%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/4 -left-16 size-72 animate-blob rounded-full bg-brand-via/40 blur-3xl"
        />
        <div className="relative z-10 max-w-xl space-y-5">
          <p className="animate-fade-up text-sm text-white/70">{APP_NAME}</p>
          <h1
            className="animate-fade-up text-3xl leading-tight font-semibold tracking-tight md:text-4xl"
            style={{ animationDelay: "80ms" }}
          >
            Laptop, điện thoại và phụ kiện công nghệ
          </h1>
          <p
            className="animate-fade-up text-white/70"
            style={{ animationDelay: "160ms" }}
          >
            Tìm sản phẩm theo nhu cầu và mức giá của bạn.
          </p>
          <div className="animate-fade-up" style={{ animationDelay: "240ms" }}>
            <Button
              asChild
              size="lg"
              className="h-11 bg-brand-gradient px-6 text-white shadow-lg shadow-brand-from/30 transition duration-200 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.98]"
            >
              <Link to="/products">
                Xem tất cả sản phẩm
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* TÙY CHỌN (xóa cả khối này nếu trễ): lối vào theo danh mục */}
      {categories.data && categories.data.length > 0 && (
        <section aria-label="Danh mục" className="flex flex-wrap gap-2">
          {categories.data.map((c) => (
            <Link
              key={c.id}
              to={`/products?categoryId=${c.id}`}
              className="rounded-full border bg-card px-4 py-2 text-sm transition-colors duration-200 hover:bg-muted"
            >
              {c.name}
            </Link>
          ))}
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Sản phẩm mới nhất
          </h2>
          <Link
            to="/products"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Xem tất cả
          </Link>
        </div>
        {latestContent}
      </section>
    </div>
  )
}
