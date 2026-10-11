import { useState } from "react"
import { Minus, Plus, ShoppingCart } from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/auth-context"
import { getErrorMessage } from "@/lib/api"
import { MAX_QTY_PER_LINE } from "./constants"
import { useCart, useCartMutations } from "./hooks"

export function AddToCart({
  productId,
  stock,
}: {
  productId: number
  stock: number
}) {
  const { status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const cart = useCart()
  const { add } = useCartMutations()
  const [quantity, setQuantity] = useState(1)

  if (stock <= 0) {
    return (
      <Button size="lg" disabled className="w-full sm:w-auto sm:px-8">
        Hết hàng
      </Button>
    )
  }

  // Server cộng dồn với số đã có trong giỏ, nên giới hạn số được thêm theo phần còn lại.
  const inCart =
    cart.data?.items.find((i) => i.productId === productId)?.quantity ?? 0
  const room = Math.min(MAX_QTY_PER_LINE, stock) - inCart
  const qty = Math.max(1, Math.min(quantity, room))

  function handleAdd() {
    if (status !== "authenticated") {
      navigate("/login", {
        state: { from: `${location.pathname}${location.search}` },
      })
      return
    }
    add.mutate(
      { productId, quantity: qty },
      {
        onSuccess: () => {
          toast.success("Đã thêm vào giỏ hàng")
          setQuantity(1)
        },
        onError: (error) =>
          toast.error(getErrorMessage(error, "Không thêm được vào giỏ hàng.")),
      }
    )
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center gap-3">
        <span className="label-mono text-muted-foreground">Số lượng</span>
        <div className="flex items-center">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Giảm số lượng"
            disabled={qty <= 1}
            onClick={() => setQuantity(qty - 1)}
          >
            <Minus />
          </Button>
          <span
            aria-live="polite"
            className="grid h-8 min-w-12 place-items-center border-y border-foreground px-2 label-mono tabular-nums"
          >
            {qty}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Tăng số lượng"
            disabled={qty >= room}
            onClick={() => setQuantity(qty + 1)}
          >
            <Plus />
          </Button>
        </div>
      </div>

      <Button
        size="lg"
        className="w-full sm:w-auto sm:px-8"
        disabled={status === "initializing" || add.isPending || room <= 0}
        onClick={handleAdd}
      >
        <ShoppingCart />
        {room <= 0 ? "Đã có tối đa trong giỏ" : "Thêm vào giỏ"}
      </Button>

      {inCart > 0 && (
        <p className="label-mono text-muted-foreground">
          Đã có {inCart} trong giỏ ·{" "}
          <Link
            to="/cart"
            className="text-foreground underline underline-offset-4"
          >
            Xem giỏ hàng
          </Link>
        </p>
      )}
    </div>
  )
}
