import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Lock, Mail } from "lucide-react"
import { AuthShell } from "@/components/auth/auth-shell"
import { FormField } from "@/components/auth/form-field"
import { Notice } from "@/components/auth/notice"
import { SubmitButton } from "@/components/auth/submit-button"
import { useAuth } from "@/features/auth/auth-context"
import { loginSchema, type LoginValues } from "@/features/auth/schemas"
import { getErrorMessage } from "@/lib/api"

interface LocationState {
  registered?: boolean
  email?: string
  from?: string
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const state = useLocation().state as LocationState | null
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: state?.email ?? "", password: "" },
  })

  async function onSubmit(values: LoginValues) {
    setServerError(null)
    try {
      await login(values)
      navigate(state?.from ?? "/", { replace: true })
    } catch (error) {
      // Sai mật khẩu: báo lỗi tại chỗ, không chuyển hướng (interceptor bỏ qua /auth/*).
      setServerError(
        getErrorMessage(error, "Không thể đăng nhập, vui lòng thử lại.")
      )
    }
  }

  return (
    <AuthShell
      title="Chào mừng trở lại"
      subtitle=""
      footer={
        <>
          Chưa có tài khoản?{" "}
          <Link
            to="/register"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Đăng ký ngay
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {state?.registered && (
          <Notice tone="success">
            Đăng ký thành công. Hãy đăng nhập để tiếp tục.
          </Notice>
        )}
        {serverError && <Notice tone="error">{serverError}</Notice>}

        <FormField
          label="Email"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="Nhập email"
          error={errors.email?.message}
          delay={80}
          {...register("email")}
        />
        <FormField
          label="Mật khẩu"
          icon={Lock}
          type="password"
          autoComplete="current-password"
          placeholder="Nhập mật khẩu"
          error={errors.password?.message}
          delay={160}
          {...register("password")}
        />

        <div
          className="animate-fade-up pt-1"
          style={{ animationDelay: "240ms" }}
        >
          <SubmitButton loading={isSubmitting}>Đăng nhập</SubmitButton>
        </div>
      </form>
    </AuthShell>
  )
}
