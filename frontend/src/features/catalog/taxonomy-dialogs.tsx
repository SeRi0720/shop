import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Tag } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { FormField } from "@/components/auth/form-field"
import { Notice } from "@/components/auth/notice"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getErrorMessage } from "@/lib/api"

// Khớp NameDto của backend (không rỗng, tối đa 100 ký tự).
const nameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tên")
    .max(100, "Tên tối đa 100 ký tự"),
})
type NameValues = z.infer<typeof nameSchema>

export function NameFormDialog({
  title,
  initialName = "",
  submitLabel,
  onClose,
  onSubmit,
}: {
  title: string
  initialName?: string
  submitLabel: string
  onClose: () => void
  onSubmit: (name: string) => Promise<void>
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: initialName },
  })

  const submit = handleSubmit(async ({ name }) => {
    setServerError(null)
    try {
      await onSubmit(name)
    } catch (error) {
      // 409 (trùng tên) và các lỗi khác hiện ngay trong hộp thoại.
      setServerError(
        getErrorMessage(error, "Không lưu được, vui lòng thử lại.")
      )
    }
  })

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {serverError && <Notice tone="error">{serverError}</Notice>}
          <FormField
            label="Tên"
            icon={Tag}
            autoFocus
            error={errors.name?.message}
            {...register("name")}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteDialog({
  noun,
  name,
  onClose,
  onConfirm,
}: {
  noun: string
  name: string
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setServerError(null)
    try {
      await onConfirm()
    } catch (error) {
      // Còn sản phẩm (kể cả đang ẩn) => backend trả 409 kèm thông báo rõ.
      setServerError(
        getErrorMessage(error, "Không xóa được, vui lòng thử lại.")
      )
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xóa {noun}?</DialogTitle>
          <DialogDescription>
            Bạn sắp xóa “{name}”. Chỉ xóa được khi không còn sản phẩm nào thuộc{" "}
            {noun} này.
          </DialogDescription>
        </DialogHeader>
        {serverError && <Notice tone="error">{serverError}</Notice>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            Xóa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
