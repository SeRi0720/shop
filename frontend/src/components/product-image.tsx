import { useState } from "react"
import { ImageOff } from "lucide-react"
import { cn } from "@/lib/utils"

export function ProductImage({
  src,
  alt,
  className,
}: {
  src?: string | null
  alt: string
  className?: string
}) {
  // Lưu URL bị lỗi (không lưu boolean) để đổi src thì tự thử lại.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (!src || failedSrc === src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "grid place-items-center bg-muted text-muted-foreground",
          className
        )}
      >
        <ImageOff aria-hidden className="size-1/3 max-w-8" />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailedSrc(src)}
      className={cn("object-cover", className)}
    />
  )
}
