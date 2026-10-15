import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { MapPin, Phone, User } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { Link, Navigate, useNavigate } from "react-router"
import { toast } from "sonner"
import { FormField } from "@/components/auth/form-field"
import { Notice } from "@/components/auth/notice"
import { SubmitButton } from "@/components/auth/submit-button"
import { FormRow } from "@/components/form-row"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/features/auth/auth-context"
import { useCart } from "@/features/cart/hooks"
import { getStockShortages } from "@/features/orders/errors"
import { useCreateOrder } from "@/features/orders/hooks"
import { checkoutSchema, type CheckoutValues } from "@/features/orders/schemas"
import type { StockShortage } from "@/features/orders/types"
import { getErrorMessage } from "@/lib/api"
import { formatPrice } from "@/lib/format"

function CheckoutSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-12 w-64" />
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  )
}

export function CheckoutPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const cart = useCart()
  const createOrder = useCreateOrder()
  const [shortages, setShortages] = useState<StockShortage[]>([])

  // Mã đơn VNPay vừa tạo, đang chuyển sang cổng thanh toán. Khác null thì khóa nút đặt hàng
  // để không đặt hai lần trong lúc trình duyệt chuyển trang.
  const [placedId, setPlacedId] = useState<number | null>(null)
  const redirecting = placedId !== null

  // Bấm Back từ cổng VNPay: trình duyệt có thể khôi phục nguyên trạng trang này (bfcache).
  // Đưa người dùng sang trang đơn thay vì để nút "Đặt hàng" kẹt ở trạng thái đang chuyển.
  useEffect(() => {
    if (placedId === null) return
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) navigate(`/orders/${placedId}`, { replace: true })
    }
    window.addEventListener("pageshow", onShow)
    return () => window.removeEventListener("pageshow", onShow)
  }, [placedId, navigate])

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      shippingName: user?.fullName ?? "",
      shippingPhone: user?.phone ?? "",
      shippingAddress: "",
      note: "",
      paymentMethod: "COD",
    },
  })
  const method = useWatch({ control, name: "paymentMethod" })

  if (cart.isPending) return <CheckoutSkeleton />
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

  const { items, totalAmount, hasProblem } = cart.data

  // Giỏ rỗng thì về /cart. Không chuyển khi vừa đặt xong: lúc đó giỏ rỗng là bình thường
  // và việc chuyển sang trang đơn (COD) hoặc sang cổng VNPay do onSubmit đảm nhận.
  if (items.length === 0 && !createOrder.isSuccess) {
    return <Navigate to="/cart" replace />
  }

  async function onSubmit(values: CheckoutValues) {
    setShortages([])
    try {
      const order = await createOrder.mutateAsync({
        shippingName: values.shippingName,
        shippingPhone: values.shippingPhone,
        shippingAddress: values.shippingAddress,
        note: values.note || undefined,
        paymentMethod: values.paymentMethod,
      })

      if (order.paymentUrl) {
        // Đơn VNPay: sang cổng thanh toán (không chuyển qua trang đơn).
        setPlacedId(order.id)
        window.location.assign(order.paymentUrl)
        return
      }

      navigate(`/orders/${order.id}`, {
        replace: true,
        state: { justPlaced: true },
      })
    } catch (error) {
      const found = getStockShortages(error)
      if (found.length > 0) {
        // Giữ nguyên trang để chỉ rõ dòng nào thiếu hàng.
        setShortages(found)
      } else {
        // Toast sống qua việc chuyển trang (trường hợp giỏ trống: trang sẽ tự về /cart).
        // Gồm cả lỗi 400 "VNPay chưa được cấu hình".
        toast.error(
          getErrorMessage(error, "Không đặt được hàng, vui lòng thử lại.")
        )
      }
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="animate-fade-up space-y-8"
    >
      <h1 className="text-4xl text-display sm:text-5xl">Thanh toán</h1>

      {shortages.length > 0 && (
        <div
          role="alert"
          className="space-y-2 border border-destructive p-3.5 text-sm text-destructive"
        >
          <p className="font-bold">Một số sản phẩm không đủ hàng:</p>
          <ul className="list-disc space-y-1 pl-5">
            {shortages.map((s) => (
              <li key={s.productId}>
                {s.name}: cần {s.requested}, hiện còn {s.available}
              </li>
            ))}
          </ul>
          <Link
            to="/cart"
            className="inline-block font-bold underline underline-offset-4"
          >
            Quay lại giỏ hàng để chỉnh sửa
          </Link>
        </div>
      )}

      {hasProblem && shortages.length === 0 && (
        <Notice tone="error">
          Giỏ hàng có sản phẩm cần xử lý.{" "}
          <Link to="/cart" className="font-bold underline underline-offset-4">
            Quay lại giỏ hàng
          </Link>
        </Notice>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-8">
          <section className="space-y-5 border border-foreground bg-card p-5 md:p-6">
            <h2 className="label-mono">Thông tin giao hàng</h2>
            <FormField
              label="Họ và tên"
              icon={User}
              autoComplete="name"
              placeholder="Nhập họ tên người nhận"
              error={errors.shippingName?.message}
              {...register("shippingName")}
            />
            <FormField
              label="Số điện thoại"
              icon={Phone}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0912345678"
              error={errors.shippingPhone?.message}
              delay={80}
              {...register("shippingPhone")}
            />
            <FormField
              label="Địa chỉ nhận hàng"
              icon={MapPin}
              autoComplete="street-address"
              placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
              error={errors.shippingAddress?.message}
              delay={160}
              {...register("shippingAddress")}
            />
            <FormRow
              label="Ghi chú (không bắt buộc)"
              htmlFor="note"
              error={errors.note?.message}
            >
              <Textarea
                id="note"
                rows={3}
                aria-invalid={!!errors.note}
                aria-describedby={errors.note ? "note-error" : undefined}
                {...register("note")}
              />
            </FormRow>
          </section>

          <fieldset className="space-y-3">
            <legend className="mb-3 label-mono">Phương thức thanh toán</legend>
            <label className="flex cursor-pointer items-start gap-3 border border-foreground bg-card p-4 has-checked:bg-muted">
              <input
                type="radio"
                value="COD"
                className="mt-1 accent-foreground"
                {...register("paymentMethod")}
              />
              <span>
                <span className="block font-bold">
                  Thanh toán khi nhận hàng (COD)
                </span>
                <span className="text-sm text-muted-foreground">
                  Trả tiền mặt cho người giao hàng.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 border border-foreground bg-card p-4 has-checked:bg-muted">
              <input
                type="radio"
                value="VNPAY"
                className="mt-1 accent-foreground"
                {...register("paymentMethod")}
              />
              <span>
                <span className="block font-bold">VNPay</span>
                <span className="text-sm text-muted-foreground">
                  Thanh toán online qua cổng VNPay. Đơn giữ hàng trong thời hạn
                  thanh toán, quá hạn sẽ tự hủy.
                </span>
              </span>
            </label>
          </fieldset>
        </div>

        <aside className="space-y-4 border border-foreground bg-card p-5 lg:sticky lg:top-20">
          <h2 className="label-mono">Đơn hàng của bạn</h2>
          <ul className="divide-y divide-foreground/20 text-sm">
            {items.map((line) => (
              <li
                key={line.productId}
                className="flex items-start justify-between gap-3 py-2"
              >
                <span className="min-w-0">
                  <span className="line-clamp-2">{line.name}</span>
                  <span className="label-mono text-muted-foreground">
                    SL {line.quantity}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatPrice(line.lineTotal)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-4">
            <span className="label-mono text-muted-foreground">Tổng cộng</span>
            <span className="price-tag text-xl tabular-nums">
              {formatPrice(totalAmount)}
            </span>
          </div>
          <SubmitButton
            loading={isSubmitting || redirecting}
            disabled={hasProblem}
          >
            {method === "VNPAY" ? "Đặt hàng và thanh toán VNPay" : "Đặt hàng"}
          </SubmitButton>
          <Button asChild variant="link" className="w-full">
            <Link to="/cart">Sửa giỏ hàng</Link>
          </Button>
        </aside>
      </div>
    </form>
  )
}
