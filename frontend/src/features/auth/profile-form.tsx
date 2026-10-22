import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Phone, User as UserIcon } from "lucide-react"
import { toast } from "sonner"
import { FormField } from "@/components/auth/form-field"
import { Notice } from "@/components/auth/notice"
import { SubmitButton } from "@/components/auth/submit-button"
import { Button } from "@/components/ui/button"
import { getErrorMessage } from "@/lib/api"
import type { User } from "./auth-context"
import { profileSchema, type ProfileValues } from "./schemas"
import { useUpdateProfile } from "./use-update-profile"

export function ProfileForm({
  user,
  onDone,
}: {
  user: User
  onDone: () => void
}) {
  const update = useUpdateProfile()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: user.fullName, phone: user.phone ?? "" },
  })

  async function onSubmit(values: ProfileValues) {
    setServerError(null)
    try {
      await update.mutateAsync({
        fullName: values.fullName,
        phone: values.phone === "" ? null : values.phone,
      })
      toast.success("Đã cập nhật thông tin")
      onDone()
    } catch (error) {
      setServerError(
        getErrorMessage(error, "Không thể cập nhật, vui lòng thử lại.")
      )
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {serverError && <Notice tone="error">{serverError}</Notice>}

      <FormField
        label="Họ và tên"
        icon={UserIcon}
        autoComplete="name"
        placeholder="Nhập họ và tên"
        error={errors.fullName?.message}
        {...register("fullName")}
      />
      <FormField
        label="Số điện thoại (để trống nếu muốn xóa)"
        icon={Phone}
        type="tel"
        autoComplete="tel"
        placeholder="Ví dụ: 0912345678"
        error={errors.phone?.message}
        {...register("phone")}
      />

      <div className="grid gap-2 pt-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onDone}
          disabled={update.isPending}
        >
          Hủy
        </Button>
        {/* Không đổi gì thì không cho gửi: tránh request thừa. */}
        <SubmitButton loading={update.isPending} disabled={!isDirty}>
          Lưu thay đổi
        </SubmitButton>
      </div>
    </form>
  )
}
