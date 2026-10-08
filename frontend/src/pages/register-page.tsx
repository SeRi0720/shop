import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import axios from "axios"
import { Lock, Mail, Phone, User } from "lucide-react"
import { AuthShell } from "@/components/auth/auth-shell"
import { FormField } from "@/components/auth/form-field"
import { Notice } from "@/components/auth/notice"
import { SubmitButton } from "@/components/auth/submit-button"
import { registerSchema, type RegisterValues } from "@/features/auth/schemas"
import { api, getErrorMessage } from "@/lib/api"

export function RegisterPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  })

  async function onSubmit(values: RegisterValues) {
    setServerError(null)
    try {
      await api.post("/auth/register", {
        email: values.email,
        password: values.password,
        fullName: values.fullName,
        phone: values.phone || undefined, // trường tùy chọn: không gửi chuỗi rỗng
      })
      // Đăng ký không tự đăng nhập: chuyển sang /login kèm email và thông báo.
      navigate("/login", {
        replace: true,
        state: { registered: true, email: values.email },
      })
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setError("email", { message: "Email này đã được sử dụng" })
      } else {
        setServerError(
          getErrorMessage(error, "Không thể đăng ký, vui lòng thử lại.")
        )
      }
    }
  }

  return (
    <AuthShell
      title="Tạo tài khoản"
      footer={
        <>
          Đã có tài khoản?{" "}
          <Link
            to="/login"
            className="font-bold text-foreground underline underline-offset-4 hover:no-underline"
          >
            Đăng nhập
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {serverError && <Notice tone="error">{serverError}</Notice>}

        <FormField
          label="Họ và tên"
          icon={User}
          autoComplete="name"
          placeholder="Nhập họ và tên"
          error={errors.fullName?.message}
          delay={60}
          {...register("fullName")}
        />
        <FormField
          label="Email"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="Nhập email"
          error={errors.email?.message}
          delay={120}
          {...register("email")}
        />
        <FormField
          label="Số điện thoại (không bắt buộc)"
          icon={Phone}
          type="tel"
          autoComplete="tel"
          placeholder="Nhập số điện thoại"
          error={errors.phone?.message}
          delay={180}
          {...register("phone")}
        />
        <FormField
          label="Mật khẩu"
          icon={Lock}
          type="password"
          autoComplete="new-password"
          placeholder="Nhập mật khẩu"
          error={errors.password?.message}
          delay={240}
          {...register("password")}
        />
        <FormField
          label="Nhập lại mật khẩu"
          icon={Lock}
          type="password"
          autoComplete="new-password"
          placeholder="Nhập lại mật khẩu"
          error={errors.confirmPassword?.message}
          delay={300}
          {...register("confirmPassword")}
        />

        <div
          className="animate-fade-up pt-2"
          style={{ animationDelay: "360ms" }}
        >
          <SubmitButton loading={isSubmitting}>Đăng ký</SubmitButton>
        </div>
      </form>
    </AuthShell>
  )
}
