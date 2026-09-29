import type { ReactNode } from "react"
import { Headphones, ShieldCheck, Truck, Zap } from "lucide-react"

export const APP_NAME = "TechShop" // đổi thành tên cửa hàng của bạn

/** Bảng thương hiệu bên trái (chỉ hiện từ màn hình lg): nhiều lớp để tạo chiều sâu. */
function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-neutral-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
      {/* Lớp 1: nền gradient */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-70 [background:radial-gradient(60%_50%_at_15%_10%,var(--brand-from),transparent_70%),radial-gradient(50%_45%_at_90%_95%,var(--brand-to),transparent_70%)]"
      />
      {/* Lớp 2: các đốm sáng mờ trôi chậm */}
      <div
        aria-hidden
        className="absolute top-1/4 -left-16 size-72 animate-blob rounded-full bg-brand-via/40 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute right-[-4rem] bottom-1/4 size-80 animate-blob rounded-full bg-brand-to/30 blur-3xl [animation-delay:-8s]"
      />
      {/* Lớp 3: lưới mờ dần ra ngoài */}
      <div
        aria-hidden
        className="absolute inset-0 [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_75%)] [background-size:48px_48px] opacity-[0.12]"
      />

      <div className="relative z-10 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-brand-gradient shadow-lg shadow-black/30">
          <Zap className="size-5" />
        </div>
        <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
      </div>

      <div className="relative z-10">
        <h2 className="max-w-md animate-fade-up text-4xl leading-tight font-semibold tracking-tight">
          Công nghệ chính hãng,
          <span className="block text-brand-gradient">
            chọn nhanh, nhận sớm.
          </span>
        </h2>

        {/* Các thẻ kính nổi lệch nhau, mỗi thẻ trôi với nhịp riêng */}
        <div className="relative mt-12 h-56 max-w-md">
          <FloatingCard
            className="top-0 left-0 [--r:-3deg]"
            delay="0s"
            icon={<ShieldCheck className="size-5" />}
            title="Thanh toán an toàn"
            text="COD và VNPay"
          />
          <FloatingCard
            className="top-16 left-24 [--r:2deg]"
            delay="-3s"
            icon={<Truck className="size-5" />}
            title="Giao hàng tận nơi"
            text="Theo dõi trạng thái đơn"
          />
          <FloatingCard
            className="top-32 left-6 [--r:-1deg]"
            delay="-6s"
            icon={<Headphones className="size-5" />}
            title="Hỗ trợ trực tuyến"
            text="Chat với cửa hàng"
          />
        </div>
      </div>

      <p className="relative z-10 text-sm text-white/50">
        © {new Date().getFullYear()} {APP_NAME}
      </p>
    </aside>
  )
}

function FloatingCard({
  className,
  delay,
  icon,
  title,
  text,
}: {
  className: string
  delay: string
  icon: ReactNode
  title: string
  text: string
}) {
  return (
    <div
      style={{ animationDelay: delay }}
      className={`absolute flex w-64 animate-float items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3.5 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.15)] backdrop-blur-md ${className}`}
    >
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-gradient">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-white/60">{text}</p>
      </div>
    </div>
  )
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="min-h-svh bg-background lg:grid lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />

      <main className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-12 sm:px-8">
        {/* Đốm sáng nền phía sau thẻ form (thấy rõ trên mobile) */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-[-10%] size-72 animate-blob rounded-full bg-brand-from/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-[-8rem] left-[-6rem] size-80 animate-blob rounded-full bg-brand-to/15 blur-3xl [animation-delay:-7s]"
        />

        <div className="relative z-10 w-full max-w-md animate-fade-up">
          {/* Vầng sáng dưới thẻ tạo cảm giác thẻ nổi lên */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-10 -bottom-5 h-14 rounded-full bg-brand-from/30 blur-2xl"
          />

          {/* Viền gradient: lớp ngoài padding 1px, lớp trong là thẻ kính */}
          <div className="rounded-[1.6rem] bg-[linear-gradient(160deg,color-mix(in_oklab,var(--brand-from)_55%,transparent),transparent_40%,transparent_60%,color-mix(in_oklab,var(--brand-to)_55%,transparent))] p-px">
            <div className="rounded-[calc(1.6rem-1px)] bg-card/85 p-7 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_24px_48px_-24px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-9 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_24px_48px_-24px_rgba(0,0,0,0.7)]">
              <div className="mb-7 space-y-1.5">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {title}
                </h1>
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              </div>
              {children}
            </div>
          </div>

          <p className="relative mt-6 text-center text-sm text-muted-foreground">
            {footer}
          </p>
        </div>
      </main>
    </div>
  )
}
