import { useMemo } from "react"
import { PackageSearch } from "lucide-react"
import { useSearchParams } from "react-router"
import { Notice } from "@/components/auth/notice"
import { EmptyState } from "@/components/empty-state"
import { SimplePagination } from "@/components/simple-pagination"
import { Button } from "@/components/ui/button"
import { ProductCardSkeleton } from "@/features/catalog/product-card-skeleton"
import { useProducts, useTaxonomy } from "@/features/catalog/hooks"
import { ProductCard } from "@/features/catalog/product-card"
import { ProductFilters } from "@/features/catalog/product-filters"
import { parseProductParams } from "@/features/catalog/product-params"
import { getErrorMessage } from "@/lib/api"
import { cn } from "@/lib/utils"

export function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(() => parseProductParams(searchParams), [searchParams])
  const categories = useTaxonomy("categories")
  const brands = useTaxonomy("brands")
  const list = useProducts(params)

  function goToPage(page: number) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set("page", String(page))
      return next
    })
    window.scrollTo({ top: 0 })
  }
  const clearFilters = () => setSearchParams({}, { replace: true })

  let content
  if (list.isError) {
    content = (
      <div className="space-y-3">
        <Notice tone="error">
          {getErrorMessage(list.error, "Không tải được danh sách sản phẩm.")}
        </Notice>
        <Button variant="outline" onClick={() => list.refetch()}>
          Thử lại
        </Button>
      </div>
    )
  } else if (list.isPending) {
    content = (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    )
  } else if (list.data.items.length === 0) {
    // total > 0 nghĩa là chỉ vì ?page=99 vượt quá số trang
    content =
      list.data.total > 0 ? (
        <EmptyState icon={PackageSearch} title="Trang này không có sản phẩm">
          <Button variant="outline" onClick={() => goToPage(1)}>
            Về trang 1
          </Button>
        </EmptyState>
      ) : (
        <EmptyState
          icon={PackageSearch}
          title="Không tìm thấy sản phẩm"
          description="Thử đổi từ khóa hoặc bỏ bớt bộ lọc."
        >
          <Button variant="outline" onClick={clearFilters}>
            Xóa bộ lọc
          </Button>
        </EmptyState>
      )
  } else {
    content = (
      <div className="space-y-6">
        <div
          className={cn(
            "grid grid-cols-2 gap-4 transition-opacity md:grid-cols-3 xl:grid-cols-4",
            list.isPlaceholderData && "opacity-60"
          )}
        >
          {list.data.items.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
        <SimplePagination
          page={list.data.page}
          totalPages={list.data.totalPages}
          summary={`${list.data.total} sản phẩm`}
          onPageChange={goToPage}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="animate-fade-up text-2xl font-semibold tracking-tight">
        Sản phẩm
      </h1>
      <ProductFilters categories={categories.data} brands={brands.data} />
      {content}
    </div>
  )
}
