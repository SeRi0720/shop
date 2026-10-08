import type { ReactNode } from "react"
import { Link } from "react-router"

export const APP_NAME = "TechShop"

const FEATURES = [
  { title: "Thanh toán an toàn", text: "COD và VNPay" },
  { title: "Giao hàng tận nơi", text: "Theo dõi trạng thái đơn" },
  { title: "Hỗ trợ trực tuyến", text: "Chat với cửa hàng" },
]

/** Bảng thương hiệu bên trái (chỉ hiện từ màn hình lg): phẳng, kẻ ô, chữ cỡ lớn. */
function BrandPanel() {
  return (
    <aside className="hidden flex-col justify-between bg-foreground text-background lg:flex">
      <Link
        to="/"
        className="border-b border-background/40 p-8 label-mono text-sm font-bold"
      >
        {APP_NAME}®
      </Link>

      <div className="space-y-12 p-8">
        <h2 className="animate-fade-up text-6xl text-display xl:text-7xl">
          Công nghệ
          <br />
          chính hãng,
          <br />
          chọn nhanh,
          <br />
          nhận sớm.
        </h2>

        <ul className="border-t border-background/40">
          {FEATURES.map((f, i) => (
            <li
              key={f.title}
              className="flex items-baseline gap-6 border-b border-background/40 py-4"
            >
              <span className="w-6 shrink-0 label-mono opacity-70">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-bold">{f.title}</span>
              <span className="ml-auto text-right label-mono opacity-70">
                {f.text}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="border-t border-background/40 p-8 label-mono opacity-70">
        © {new Date().getFullYear()} {APP_NAME}
      </p>
    </aside>
  )
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="min-h-svh bg-background lg:grid lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />

      <main className="flex min-h-svh flex-col items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md animate-fade-up">
          {/* Logo thu gọn trên mobile (bảng bên trái đã ẩn) */}
          <Link
            to="/"
            className="mb-6 inline-block label-mono text-sm font-bold lg:hidden"
          >
            {APP_NAME}®
          </Link>

          <div className="border border-foreground bg-card p-7 sm:p-9">
            <div className="mb-7 space-y-2">
              <h1 className="text-4xl text-display">{title}</h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {children}
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {footer}
          </p>
        </div>
      </main>
    </div>
  )
}
