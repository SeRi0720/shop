import { z } from "zod"
import type { ProductDetail, ProductInput } from "./types"

const MAX_PRICE = 2_000_000_000 // khớp @Max của CreateProductDto
const MAX_STOCK = 1_000_000
export const MAX_SPECS = 30 // khớp validator specs ở backend

const fmt = (n: number) => n.toLocaleString("vi-VN")

const intString = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Vui lòng nhập ${label.toLowerCase()}`)
    .refine(
      (v) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max,
      `${label} phải là số nguyên từ ${fmt(min)} đến ${fmt(max)}`
    )

const specRow = z.object({
  key: z.string().trim().max(50, "Tên thông số tối đa 50 ký tự"),
  value: z.string().trim().max(200, "Giá trị tối đa 200 ký tự"),
})

export const productFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tên sản phẩm")
    .max(200, "Tên tối đa 200 ký tự"),
  description: z.string().max(5000, "Mô tả tối đa 5000 ký tự"),
  price: intString("Giá", 1, MAX_PRICE),
  stock: intString("Tồn kho", 0, MAX_STOCK),
  categoryId: z.string().min(1, "Vui lòng chọn danh mục"),
  brandId: z.string().min(1, "Vui lòng chọn thương hiệu"),
  specs: z
    .array(specRow)
    .max(MAX_SPECS, `Tối đa ${MAX_SPECS} thông số`)
    .superRefine((rows, ctx) => {
      const seen = new Set<string>()
      rows.forEach((row, i) => {
        if (row.key === "" && row.value === "") return // dòng trống bị bỏ qua
        if (row.key === "") {
          ctx.addIssue({
            code: "custom",
            path: [i, "key"],
            message: "Nhập tên thông số",
          })
        } else if (row.value === "") {
          ctx.addIssue({
            code: "custom",
            path: [i, "value"],
            message: "Nhập giá trị",
          })
        } else {
          const k = row.key.toLowerCase()
          if (seen.has(k)) {
            ctx.addIssue({
              code: "custom",
              path: [i, "key"],
              message: "Tên thông số bị trùng",
            })
          }
          seen.add(k)
        }
      })
    }),
})

export type ProductFormValues = z.infer<typeof productFormSchema>

export const emptyProductForm: ProductFormValues = {
  name: "",
  description: "",
  price: "",
  stock: "",
  categoryId: "",
  brandId: "",
  specs: [],
}

export function toFormValues(p: ProductDetail): ProductFormValues {
  return {
    name: p.name,
    description: p.description ?? "",
    price: String(p.price),
    stock: String(p.stock),
    categoryId: String(p.category.id),
    brandId: String(p.brand.id),
    specs: Object.entries(p.specs).map(([key, value]) => ({ key, value })),
  }
}

export function toProductInput(v: ProductFormValues): ProductInput {
  return {
    name: v.name,
    description: v.description.trim(),
    price: Number(v.price),
    stock: Number(v.stock),
    categoryId: Number(v.categoryId),
    brandId: Number(v.brandId),
    specs: Object.fromEntries(
      v.specs
        .filter((r) => r.key !== "" && r.value !== "")
        .map((r) => [r.key, r.value])
    ),
  }
}
