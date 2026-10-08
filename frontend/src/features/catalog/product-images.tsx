import { useRef, type ChangeEvent } from "react"
import { ImagePlus, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { ProductImage } from "@/components/product-image"
import { Button } from "@/components/ui/button"
import { getErrorMessage } from "@/lib/api"
import { useDeleteImage, useUploadImages } from "./hooks"
import type { ProductDetail } from "./types"

const MAX_FILES_PER_REQUEST = 5
const MAX_IMAGES = 8
const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED = ["image/jpeg", "image/png", "image/webp"]

export function ProductImages({ product }: { product: ProductDetail }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadImages(product.id)
  const remove = useDeleteImage(product.id)
  const remaining = MAX_IMAGES - product.images.length

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = "" // cho phép chọn lại đúng file vừa chọn
    if (files.length === 0) return

    if (files.length > MAX_FILES_PER_REQUEST) {
      return toast.error(`Mỗi lần tải tối đa ${MAX_FILES_PER_REQUEST} ảnh`)
    }
    if (files.length > remaining) {
      return toast.error(
        `Chỉ còn thêm được ${remaining} ảnh (tối đa ${MAX_IMAGES} ảnh/sản phẩm)`
      )
    }
    if (files.some((f) => !ALLOWED.includes(f.type))) {
      return toast.error("Chỉ nhận ảnh jpeg, png, webp")
    }
    if (files.some((f) => f.size > MAX_BYTES)) {
      return toast.error("Mỗi ảnh tối đa 2 MB")
    }

    try {
      await upload.mutateAsync(files)
      toast.success(`Đã tải lên ${files.length} ảnh`)
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Không tải được ảnh, vui lòng thử lại.")
      )
    }
  }

  async function onRemove(imageId: number) {
    try {
      await remove.mutateAsync(imageId)
      toast.success("Đã xóa ảnh")
    } catch (error) {
      toast.error(getErrorMessage(error, "Không xóa được ảnh."))
    }
  }

  return (
    <section className="space-y-4 border border-foreground bg-card p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Ảnh sản phẩm</h2>
          <p className="text-sm text-muted-foreground">
            {product.images.length}/{MAX_IMAGES} ảnh. Ảnh đầu tiên là ảnh đại
            diện.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={upload.isPending || remaining <= 0}
          onClick={() => inputRef.current?.click()}
        >
          {upload.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <ImagePlus />
          )}
          Tải ảnh lên
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={onPick}
        />
      </div>

      {product.images.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có ảnh. Khách sẽ thấy ảnh thay thế.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {product.images.map((img) => (
            <li
              key={img.id}
              className="relative overflow-hidden rounded-lg border"
            >
              <ProductImage
                src={img.url}
                alt={`Ảnh của ${product.name}`}
                className="aspect-square w-full"
              />
              <Button
                type="button"
                variant="secondary"
                size="icon-xs"
                className="absolute top-1.5 right-1.5 shadow"
                aria-label="Xóa ảnh"
                disabled={remove.isPending && remove.variables === img.id}
                onClick={() => onRemove(img.id)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
