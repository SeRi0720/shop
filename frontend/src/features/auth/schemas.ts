import { z } from "zod"

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập email")
    .email("Email không hợp lệ"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
})
export type LoginValues = z.infer<typeof loginSchema>

// Phải khớp backend/src/common/phone.ts.
const PHONE_REGEX = /^(0|\+84)\d{9}$/
const phoneField = z
  .string()
  .trim()
  .regex(PHONE_REGEX, "Số điện thoại không hợp lệ")
  .or(z.literal(""))

const fullNameField = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập họ tên")
  .max(100, "Họ tên tối đa 100 ký tự")

export const registerSchema = z
  .object({
    fullName: fullNameField,
    email: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập email")
      .email("Email không hợp lệ"),
    phone: phoneField, // tùy chọn
    password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
    confirmPassword: z.string().min(1, "Vui lòng nhập lại mật khẩu"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu nhập lại không khớp",
  })
export type RegisterValues = z.infer<typeof registerSchema>

export const profileSchema = z.object({
  fullName: fullNameField,
  phone: phoneField, // rỗng = xóa số
})
export type ProfileValues = z.infer<typeof profileSchema>
