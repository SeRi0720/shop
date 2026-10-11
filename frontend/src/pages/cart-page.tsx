import { AlertTriangle, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react"
import { Link } from "react-router"
import { toast } from "sonner"
import { Notice } from "@/components/auth/notice"
import { EmptyState } from "@/components/empty-state"
import { ProductImage } from "@/components/product-image"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { MAX_QTY_PER_LINE } from "@/features/cart/constants"
import { useCart, useCartMutations } from "@/features/cart/hooks"
import type { CartLine } from "@/features/cart/types"
import { getErrorMessage } from "@/lib/api"
import { formatPrice } from "@/lib/format"

function problemText(line: CartLine): string | null {
  switch (line.problem) {
    case "HIDDEN":
      return "Sản phẩm đã ngừng bán, hãy xóa khỏi giỏ."
    case "OUT_OF_STOCK":
      return "Đã hết hàng, hãy xóa khỏi giỏ."
    case "EXCEEDS_STOCK":
      return `Chỉ còn ${line.stock} sản phẩm trong kho.`
    default:
      return null
  }
}

function CartSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-12 w-56" />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-px">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  )
}

function CartRow({
  line,
  busy,
  onChange,
  onRemove,
}: {
  line: CartLine
  busy: boolean
  onChange: (quantity: number) => void
  onRemove: () => void
}) {
  const maxQty = Math.min(MAX_QTY_PER_LINE, line.stock)
  // Backend từ chối PATCH với sản phẩm ẩn (404) hoặc hết hàng (409): chỉ cho xóa.
  const locked = line.problem === "HIDDEN" || line.problem === "OUT_OF_STOCK"
  const warning = problemText(line)

  return (
    <li className="grid grid-cols-[5rem_1fr] gap-4 border-b border-foreground p-4 last:border-b-0 sm:grid-cols-[6rem_1fr_auto]">
      <ProductImage
        src={line.thumbnailUrl}
        alt={line.name}
        className="aspect-square w-full border border-foreground"
      />

      <div className="min-w-0 space-y-2">
        {line.problem === "HIDDEN" ? (
          <p className="line-clamp-2 font-bold">{line.name}</p>
        ) : (
          <Link
            to={`/products/${line.productId}`}
            className="line-clamp-2 font-bold hover:underline"
          >
            {line.name}
          </Link>
        )}
        <p className="label-mono text-muted-foreground tabular-nums">
          {formatPrice(line.price)}
        </p>

        {warning && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-destructive">
            <AlertTriangle aria-hidden className="size-4 shrink-0" />
            {warning}
            {line.problem === "EXCEEDS_STOCK" && (
              <Button
                variant="outline"
                size="xs"
                disabled={busy}
                onClick={() => onChange(line.stock)}
              >
                Đặt về {line.stock}
              </Button>
            )}
          </p>
        )}

        <div className="flex items-center">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Giảm số lượng"
            disabled={busy || locked || line.quantity <= 1}
            onClick={() => onChange(line.quantity - 1)}
          >
            <Minus />
          </Button>
          <span
            aria-live="polite"
            className="grid h-8 min-w-12 place-items-center border-y border-foreground px-2 label-mono tabular-nums"
          >
            {line.quantity}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Tăng số lượng"
            disabled={busy || locked || line.quantity >= maxQty}
            onClick={() => onChange(line.quantity + 1)}
          >
            <Plus />
          </Button>
        </div>
      </div>

      <div className="col-span-2 flex items-center justify-between gap-4 sm:col-span-1 sm:flex-col sm:items-end">
        <p className="font-bold tabular-nums">{formatPrice(line.lineTotal)}</p>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          aria-label={`Xóa ${line.name} khỏi giỏ`}
          onClick={onRemove}
        >
          <Trash2 />
          Xóa
        </Button>
      </div>
    </li>
  )
}

export function CartPage() {
  const cart = useCart()
  const { setQuantity, remove } = useCartMutations()
  // PATCH đặt số lượng tuyệt đối: khóa nút khi đang gửi để bấm nhanh không gửi hai lần cùng giá trị.
  const busy = setQuantity.isPending || remove.isPending

  if (cart.isPending) return <CartSkeleton />
  if (cart.isError) {
    return (
      <div className="space-y-3">
        <Notice tone="error">
          {getErrorMessage(cart.error, "Không tải được giỏ hàng.")}
        </Notice>
        <Button variant="outline" onClick={() => cart.refetch()}>
          Thử lại
        </Button>
      </div>
    )
  }

  const { items, totalQuantity, totalAmount, hasProblem } = cart.data

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="Giỏ hàng trống"
        description="Hãy chọn vài sản phẩm để bắt đầu."
      >
        <Button asChild>
          <Link to="/products">Xem sản phẩm</Link>
        </Button>
      </EmptyState>
    )
  }

  const onError = (error: unknown) =>
    toast.error(getErrorMessage(error, "Không cập nhật được giỏ hàng."))

  return (
    <div className="animate-fade-up space-y-8">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-4xl text-display sm:text-5xl">Giỏ hàng</h1>
        <p className="label-mono text-muted-foreground">
          {totalQuantity} sản phẩm
        </p>
      </div>

      {hasProblem && (
        <Notice tone="error">
          Một số sản phẩm trong giỏ có vấn đề. Hãy xử lý các dòng được đánh dấu
          trước khi thanh toán.
        </Notice>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_20rem]">
        <ul className="border border-foreground bg-card">
          {items.map((line) => (
            <CartRow
              key={line.productId}
              line={line}
              busy={busy}
              onChange={(quantity) =>
                setQuantity.mutate(
                  { productId: line.productId, quantity },
                  { onError }
                )
              }
              onRemove={() =>
                remove.mutate(line.productId, {
                  onError,
                  onSuccess: () => toast.success("Đã xóa khỏi giỏ hàng"),
                })
              }
            />
          ))}
        </ul>

        <aside className="space-y-4 border border-foreground bg-card p-5 lg:sticky lg:top-20">
          <h2 className="label-mono">Tóm tắt đơn hàng</h2>
          <div className="flex items-center justify-between gap-4">
            <span className="label-mono text-muted-foreground">Tổng cộng</span>
            <span className="price-tag text-xl tabular-nums">
              {formatPrice(totalAmount)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Thanh toán khi nhận hàng (COD).
          </p>

          {hasProblem ? (
            <>
              <Button size="lg" disabled className="w-full">
                Thanh toán
              </Button>
              <p className="text-sm text-destructive">
                Xử lý các dòng lỗi để tiếp tục.
              </p>
            </>
          ) : (
            <Button asChild size="lg" className="w-full">
              <Link to="/checkout">Thanh toán</Link>
            </Button>
          )}

          <Button asChild variant="link" className="w-full">
            <Link to="/products">Tiếp tục mua sắm</Link>
          </Button>
        </aside>
      </div>
    </div>
  )
}
