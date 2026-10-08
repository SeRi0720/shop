import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-none border border-foreground px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider whitespace-nowrap uppercase transition-colors focus-visible:outline-2 focus-visible:outline-foreground has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-foreground text-background",
        secondary: "bg-muted text-foreground",
        // Nhãn giá: dùng màu nhấn
        price: "bg-cta text-cta-foreground",
        destructive: "border-destructive bg-transparent text-destructive",
        outline: "bg-transparent text-foreground [a]:hover:bg-muted",
        ghost: "border-transparent hover:bg-muted",
        link: "border-transparent text-foreground underline underline-offset-4 hover:no-underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
