import { z } from "zod"

export const checkoutSchema = z.object({
  shippingName: z
    .string()
    .trim()
    .min(2, "Họ tên tối thiểu 2 ký tự")
    .max(100, "Họ tên tối đa 100 ký tự"),
  shippingPhone: z
    .string()
    .trim()
    .regex(/^(0|\+84)\d{9}$/, "Số điện thoại không hợp lệ"),
  shippingAddress: z
    .string()
    .trim()
    .min(5, "Địa chỉ tối thiểu 5 ký tự")
    .max(255, "Địa chỉ tối đa 255 ký tự"),
  paymentMethod: z.enum(["COD", "VNPAY"]),
  note: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự"),
})
export type CheckoutValues = z.infer<typeof checkoutSchema>
