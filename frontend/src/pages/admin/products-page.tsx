import { Link, useSearchParams } from "react-router"
import { Eye, EyeOff, Pencil, Plus, Search } from "lucide-react"
import { toast } from "sonner"
import { Notice } from "@/components/auth/notice"
import { ProductImage } from "@/components/product-image"
import { SimplePagination } from "@/components/simple-pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useAdminProducts,
  useToggleProductActive,
} from "@/features/catalog/hooks"
import { getErrorMessage } from "@/lib/api"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useUrlTextParam } from "@/lib/use-url-text-param"

const PAGE_SIZE = 10
const MAX_PAGE = 100000 // khớp @Max của ProductQueryDto
const COLUMN_COUNT = 7 // ID, Ảnh, Tên, Giá, Tồn kho, Trạng thái, Thao tác

export function AdminProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Chuẩn hóa: ?page=abc, ?page=-5, ?page=1e9 đều về giá trị hợp lệ.
  const q = searchParams.get("q")?.trim() ?? ""
  const page = Math.min(
    MAX_PAGE,
    Math.max(1, Number.parseInt(searchParams.get("page") ?? "", 10) || 1)
  )

  const [input, setInput] = useUrlTextParam("q", q)

  const list = useAdminProducts({ q: q || undefined, page, limit: PAGE_SIZE })
  const toggleActive = useToggleProductActive()

  function goToPage(next: number) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      params.set("page", String(next))
      return params
    })
  }

  async function toggle(id: number, name: string, isActive: boolean) {
    try {
      await toggleActive.mutateAsync({ id, isActive })
      toast.success(isActive ? `Đã hiện “${name}”` : `Đã ẩn “${name}”`)
    } catch (error) {
      toast.error(getErrorMessage(error, "Không đổi được trạng thái."))
    }
  }

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sản phẩm</h1>
          <p className="text-sm text-muted-foreground">
            Gồm cả sản phẩm đang ẩn. Sản phẩm ẩn không hiện với khách.
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/products/new">
            <Plus />
            Thêm sản phẩm
          </Link>
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tìm theo tên sản phẩm..."
          aria-label="Tìm sản phẩm theo tên"
          className="h-10 pl-9"
        />
      </div>

      {list.isError ? (
        <div className="space-y-3">
          <Notice tone="error">
            {getErrorMessage(list.error, "Không tải được danh sách sản phẩm.")}
          </Notice>
          <Button variant="outline" onClick={() => list.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : (
        <>
          <div
            className={cn(
              "rounded-xl border bg-card transition-opacity",
              list.isPlaceholderData && "opacity-60"
            )}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead className="w-16">Ảnh</TableHead>
                  <TableHead>Tên</TableHead>
                  <TableHead className="text-right">Giá</TableHead>
                  <TableHead className="text-right">Tồn kho</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="w-24 text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.isPending &&
                  Array.from({ length: 5 }, (_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-6" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="size-10 rounded-md" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-48" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-4 w-10" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-4 w-14" />
                      </TableCell>
                    </TableRow>
                  ))}
                {list.data?.items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={COLUMN_COUNT}
                      className="py-12 text-center text-muted-foreground"
                    >
                      {q
                        ? `Không có sản phẩm nào khớp “${q}”.`
                        : "Chưa có sản phẩm nào."}
                    </TableCell>
                  </TableRow>
                )}
                {list.data?.items.map((p) => {
                  const pending =
                    toggleActive.isPending &&
                    toggleActive.variables?.id === p.id
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {p.id}
                      </TableCell>
                      <TableCell>
                        <ProductImage
                          src={p.thumbnailUrl}
                          alt={p.name}
                          className="size-10 rounded-md"
                        />
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.brand.name} · {p.category.name}
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPrice(p.price)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.stock}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.isActive ? "secondary" : "outline"}>
                          {p.isActive ? "Đang bán" : "Đang ẩn"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          asChild
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Sửa ${p.name}`}
                        >
                          <Link to={`/admin/products/${p.id}`}>
                            <Pencil />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={pending}
                          aria-label={
                            p.isActive ? `Ẩn ${p.name}` : `Hiện ${p.name}`
                          }
                          onClick={() => toggle(p.id, p.name, !p.isActive)}
                        >
                          {p.isActive ? <EyeOff /> : <Eye />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {list.data && (
            <SimplePagination
              page={list.data.page}
              totalPages={list.data.totalPages}
              summary={`${list.data.total} sản phẩm`}
              onPageChange={goToPage}
            />
          )}
        </>
      )}
    </div>
  )
}
