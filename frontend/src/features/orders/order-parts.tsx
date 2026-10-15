import { formatPrice } from "@/lib/format"
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "./labels"
import type { Order } from "./types"

export function OrderItems({ order }: { order: Order }) {
  return (
    <section className="border border-foreground bg-card">
      <ul>
        {order.items.map((line) => (
          <li
            key={line.productId}
            className="flex items-start justify-between gap-4 border-b border-foreground p-4"
          >
            <div className="min-w-0 space-y-1">
              <p className="line-clamp-2 font-bold">{line.productName}</p>
              <p className="label-mono text-muted-foreground tabular-nums">
                {formatPrice(line.unitPrice)} × {line.quantity}
              </p>
            </div>
            <p className="shrink-0 font-bold tabular-nums">
              {formatPrice(line.lineTotal)}
            </p>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-4 p-4">
        <span className="label-mono text-muted-foreground">Tổng cộng</span>
        <span className="price-tag text-xl tabular-nums">
          {formatPrice(order.totalAmount)}
        </span>
      </div>
    </section>
  )
}

export function ShippingInfo({ order }: { order: Order }) {
  return (
    <div className="space-y-2">
      <h2 className="label-mono">Giao hàng</h2>
      <p className="font-bold">{order.shippingName}</p>
      <p className="text-sm tabular-nums">{order.shippingPhone}</p>
      <p className="text-sm">{order.shippingAddress}</p>
      {order.note && (
        <p className="text-sm whitespace-pre-line text-muted-foreground">
          Ghi chú: {order.note}
        </p>
      )}
    </div>
  )
}

export function PaymentInfo({ order }: { order: Order }) {
  return (
    <div className="space-y-2">
      <h2 className="label-mono">Thanh toán</h2>
      <p className="text-sm">{PAYMENT_METHOD_LABEL[order.paymentMethod]}</p>
      {order.paymentStatus && (
        <p className="text-sm text-muted-foreground">
          {PAYMENT_STATUS_LABEL[order.paymentStatus]}
        </p>
      )}
    </div>
  )
}
