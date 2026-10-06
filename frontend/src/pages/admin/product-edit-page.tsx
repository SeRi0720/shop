import { ArrowLeft, PackageX } from "lucide-react"
import { Link, useParams } from "react-router"
import { toast } from "sonner"
import { Notice } from "@/components/auth/notice"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAdminProduct, useUpdateProduct } from "@/features/catalog/hooks"
import { ProductForm } from "@/features/catalog/product-form"
import {
  toFormValues,
  toProductInput,
} from "@/features/catalog/product-form-schema"
import { ProductImages } from "@/features/catalog/product-images"
import { getErrorMessage, isNotFound } from "@/lib/api"
import { parseId } from "@/lib/parse-id"

export function AdminProductEditPage() {
  const { id: rawId } = useParams()
  const id = parseId(rawId)
  const product = useAdminProduct(id)
  const update = useUpdateProduct()

  let body
  if (id === null || isNotFound(product.error)) {
    body = (
      <EmptyState
        icon={PackageX}
        title="Không tìm thấy sản phẩm"
        description="Sản phẩm không tồn tại hoặc đã bị xóa."
      >
        <Button asChild variant="outline">
          <Link to="/admin/products">Về danh sách</Link>
        </Button>
      </EmptyState>
    )
  } else if (product.isPending) {
    body = <Skeleton className="h-96 w-full rounded-2xl" />
  } else if (product.isError) {
    body = (
      <div className="space-y-3">
        <Notice tone="error">
          {getErrorMessage(product.error, "Không tải được sản phẩm.")}
        </Notice>
        <Button variant="outline" onClick={() => product.refetch()}>
          Thử lại
        </Button>
      </div>
    )
  } else {
    const p = product.data
    body = (
      <>
        {/* key: đổi sang sản phẩm khác thì form được tạo lại với dữ liệu mới */}
        <ProductForm
          key={p.id}
          defaultValues={toFormValues(p)}
          submitLabel="Lưu thay đổi"
          onSubmit={async (values) => {
            await update.mutateAsync({
              id: p.id,
              input: toProductInput(values),
            })
            toast.success("Đã lưu sản phẩm")
          }}
        />
        <ProductImages product={p} />
      </>
    )
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-up space-y-6">
      <div className="space-y-1">
        <Link
          to="/admin/products"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Sản phẩm
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {product.data ? `Sửa: ${product.data.name}` : "Sửa sản phẩm"}
        </h1>
      </div>
      {body}
    </div>
  )
}
