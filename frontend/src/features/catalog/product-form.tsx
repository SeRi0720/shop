import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { Link } from "react-router"
import { Notice } from "@/components/auth/notice"
import { FormRow } from "@/components/form-row"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { getErrorMessage } from "@/lib/api"
import { useTaxonomy } from "./hooks"
import {
  MAX_SPECS,
  productFormSchema,
  type ProductFormValues,
} from "./product-form-schema"

export function ProductForm({
  defaultValues,
  submitLabel,
  onSubmit,
}: {
  defaultValues: ProductFormValues
  submitLabel: string
  onSubmit: (values: ProductFormValues) => Promise<void>
}) {
  const categories = useTaxonomy("categories")
  const brands = useTaxonomy("brands")
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
  })
  const specs = useFieldArray({ control, name: "specs" })

  const submit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await onSubmit(values)
    } catch (error) {
      setServerError(
        getErrorMessage(error, "Không lưu được sản phẩm, vui lòng thử lại.")
      )
    }
  })

  // Đợi danh mục/thương hiệu tải xong để Select hiển thị đúng giá trị đang chọn.
  if (categories.isPending || brands.isPending) {
    return <Skeleton className="h-96 w-full" />
  }
  if (categories.isError || brands.isError) {
    return (
      <Notice tone="error">
        Không tải được danh mục hoặc thương hiệu. Hãy tải lại trang.
      </Notice>
    )
  }

  const invalid = (name: keyof ProductFormValues) => ({
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  })

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {serverError && <Notice tone="error">{serverError}</Notice>}

      <div className="space-y-5 border border-foreground bg-card p-5 md:p-6">
        <FormRow
          label="Tên sản phẩm"
          htmlFor="name"
          error={errors.name?.message}
        >
          <Input
            id="name"
            className="h-10"
            {...invalid("name")}
            {...register("name")}
          />
        </FormRow>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormRow
            label="Danh mục"
            htmlFor="categoryId"
            error={errors.categoryId?.message}
          >
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="categoryId"
                    className="h-10 w-full"
                    {...invalid("categoryId")}
                  >
                    <SelectValue placeholder="Chọn danh mục" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.data.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormRow>
          <FormRow
            label="Thương hiệu"
            htmlFor="brandId"
            error={errors.brandId?.message}
          >
            <Controller
              control={control}
              name="brandId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="brandId"
                    className="h-10 w-full"
                    {...invalid("brandId")}
                  >
                    <SelectValue placeholder="Chọn thương hiệu" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.data.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormRow>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormRow
            label="Giá (VND)"
            htmlFor="price"
            error={errors.price?.message}
          >
            <Input
              id="price"
              inputMode="numeric"
              className="h-10"
              placeholder="VD: 15990000"
              {...invalid("price")}
              {...register("price")}
            />
          </FormRow>
          <FormRow
            label="Tồn kho"
            htmlFor="stock"
            error={errors.stock?.message}
          >
            <Input
              id="stock"
              inputMode="numeric"
              className="h-10"
              placeholder="VD: 25"
              {...invalid("stock")}
              {...register("stock")}
            />
          </FormRow>
        </div>

        <FormRow
          label="Mô tả"
          htmlFor="description"
          error={errors.description?.message}
        >
          <Textarea
            id="description"
            rows={5}
            {...invalid("description")}
            {...register("description")}
          />
        </FormRow>
      </div>

      <div className="space-y-4 border border-foreground bg-card p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Thông số kỹ thuật</h2>
            <p className="text-sm text-muted-foreground">
              Cặp tên - giá trị tự do. Dòng để trống cả hai ô sẽ bị bỏ qua.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={specs.fields.length >= MAX_SPECS}
            onClick={() => specs.append({ key: "", value: "" })}
          >
            <Plus />
            Thêm dòng
          </Button>
        </div>

        {(errors.specs?.root?.message ?? errors.specs?.message) && (
          <p role="alert" className="text-sm text-destructive">
            {errors.specs?.root?.message ?? errors.specs?.message}
          </p>
        )}

        {specs.fields.map((field, index) => {
          const rowErrors = errors.specs?.[index]
          return (
            <div
              key={field.id}
              className="grid items-start gap-2 sm:grid-cols-[1fr_1fr_auto]"
            >
              <div className="space-y-1">
                <Input
                  aria-label={`Tên thông số ${index + 1}`}
                  placeholder="VD: RAM"
                  aria-invalid={!!rowErrors?.key}
                  {...register(`specs.${index}.key`)}
                />
                {rowErrors?.key && (
                  <p role="alert" className="text-sm text-destructive">
                    {rowErrors.key.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Input
                  aria-label={`Giá trị thông số ${index + 1}`}
                  placeholder="VD: 16 GB"
                  aria-invalid={!!rowErrors?.value}
                  {...register(`specs.${index}.value`)}
                />
                {rowErrors?.value && (
                  <p role="alert" className="text-sm text-destructive">
                    {rowErrors.value.message}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="justify-self-end"
                aria-label={`Xóa thông số ${index + 1}`}
                onClick={() => specs.remove(index)}
              >
                <Trash2 />
              </Button>
            </div>
          )
        })}
        {specs.fields.length === 0 && (
          <p className="text-sm text-muted-foreground">Chưa có thông số nào.</p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" size="lg" className="h-10 px-4">
          <Link to="/admin/products">Hủy</Link>
        </Button>
        <Button
          type="submit"
          size="lg"
          className="h-10 px-5"
          disabled={isSubmitting}
        >
          {isSubmitting && <Loader2 className="animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
