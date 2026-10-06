import { ArrowLeft } from "lucide-react"
import { Link, useNavigate } from "react-router"
import { toast } from "sonner"
import { useCreateProduct } from "@/features/catalog/hooks"
import { ProductForm } from "@/features/catalog/product-form"
import {
  emptyProductForm,
  toProductInput,
} from "@/features/catalog/product-form-schema"

export function AdminProductNewPage() {
  const navigate = useNavigate()
  const create = useCreateProduct()

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
        <h1 className="text-2xl font-semibold tracking-tight">Thêm sản phẩm</h1>
        <p className="text-sm text-muted-foreground">
          Nhập thông tin trước. Sau khi lưu bạn sẽ được chuyển sang trang sửa để
          tải ảnh.
        </p>
      </div>
      <ProductForm
        defaultValues={emptyProductForm}
        submitLabel="Tạo sản phẩm"
        onSubmit={async (values) => {
          const product = await create.mutateAsync(toProductInput(values))
          toast.success("Đã tạo sản phẩm. Hãy tải ảnh lên bên dưới.")
          navigate(`/admin/products/${product.id}`, { replace: true })
        }}
      />
    </div>
  )
}
