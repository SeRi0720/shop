import { Search, X } from "lucide-react"
import { useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useUrlTextParam } from "@/lib/use-url-text-param"
import { parseProductParams } from "./product-params"
import type { NamedItem, ProductSort } from "./types"

const FILTER_KEYS = [
  "q",
  "categoryId",
  "brandId",
  "minPrice",
  "maxPrice",
  "sort",
]
const SORT_LABELS: Record<ProductSort, string> = {
  newest: "Mới nhất",
  price_asc: "Giá tăng dần",
  price_desc: "Giá giảm dần",
}
const rawParam = (sp: URLSearchParams, name: string) =>
  (sp.get(name) ?? "").trim()
const digitsOnly = (v: string) => v.replace(/\D/g, "")

export function ProductFilters({
  categories = [],
  brands = [],
}: {
  categories?: NamedItem[]
  brands?: NamedItem[]
}) {
  const [sp, setSearchParams] = useSearchParams()
  const params = parseProductParams(sp)
  const [q, setQ] = useUrlTextParam("q", rawParam(sp, "q"))
  const [minPrice, setMinPrice] = useUrlTextParam(
    "minPrice",
    rawParam(sp, "minPrice")
  )
  const [maxPrice, setMaxPrice] = useUrlTextParam(
    "maxPrice",
    rawParam(sp, "maxPrice")
  )
  const hasFilters = FILTER_KEYS.some((key) => sp.has(key))

  function setParam(name: string, value: string | undefined) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(name, value)
        else next.delete(name)
        next.delete("page") // đổi bộ lọc thì về trang 1
        return next
      },
      { replace: true }
    )
  }
  const fromSelect = (v: string) => (v === "all" ? undefined : v)

  return (
    <div className="space-y-3 border border-foreground bg-card p-4">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên sản phẩm..."
          aria-label="Tìm sản phẩm theo tên"
          className="h-11 pl-10"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Select
          value={params.categoryId ? String(params.categoryId) : "all"}
          onValueChange={(v) => setParam("categoryId", fromSelect(v))}
        >
          <SelectTrigger aria-label="Lọc theo danh mục" className="h-10 w-full">
            <SelectValue placeholder="Danh mục" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả danh mục</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={params.brandId ? String(params.brandId) : "all"}
          onValueChange={(v) => setParam("brandId", fromSelect(v))}
        >
          <SelectTrigger
            aria-label="Lọc theo thương hiệu"
            className="h-10 w-full"
          >
            <SelectValue placeholder="Thương hiệu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả thương hiệu</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={String(b.id)}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={minPrice}
          onChange={(e) => setMinPrice(digitsOnly(e.target.value))}
          inputMode="numeric"
          placeholder="Giá từ (₫)"
          aria-label="Giá tối thiểu"
          className="h-10"
        />
        <Input
          value={maxPrice}
          onChange={(e) => setMaxPrice(digitsOnly(e.target.value))}
          inputMode="numeric"
          placeholder="Giá đến (₫)"
          aria-label="Giá tối đa"
          className="h-10"
        />

        <Select
          value={params.sort ?? "newest"}
          onValueChange={(v) =>
            setParam("sort", v === "newest" ? undefined : v)
          }
        >
          <SelectTrigger aria-label="Sắp xếp" className="h-10 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as ProductSort[]).map((s) => (
              <SelectItem key={s} value={s}>
                {SORT_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSearchParams({}, { replace: true })}
        >
          <X />
          Xóa bộ lọc
        </Button>
      )}
    </div>
  )
}
