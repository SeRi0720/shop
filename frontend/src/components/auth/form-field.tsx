import { useId, useState, type ComponentProps, type ComponentType } from "react"
import { Eye, EyeOff, type LucideProps } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type FormFieldProps = ComponentProps<"input"> & {
  label: string
  icon: ComponentType<LucideProps>
  error?: string
  /** Độ trễ (ms) của hiệu ứng xuất hiện, để các ô hiện lần lượt. */
  delay?: number
}

export function FormField({
  label,
  icon: Icon,
  error,
  delay = 0,
  type = "text",
  className,
  ref,
  ...props
}: FormFieldProps) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const isPassword = type === "password"

  return (
    <div
      className="animate-fade-up space-y-2"
      style={{ animationDelay: `${delay}ms` }}
    >
      <Label htmlFor={id}>{label}</Label>
      <div className="group relative">
        <Icon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground"
        />
        <Input
          id={id}
          ref={ref}
          type={isPassword && visible ? "text" : type}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn("h-11 pl-10", isPassword && "pr-11", className)}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-none text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground"
          >
            {visible ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        )}
      </div>
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="animate-fade-up text-sm font-medium text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  )
}
