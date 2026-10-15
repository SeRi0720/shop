import { useState } from "react"
import { Loader2 } from "lucide-react"
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

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = "Đóng",
  onClose,
  onConfirm,
}: {
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
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
      onClose()
    } catch (error) {
      // 409 (đã thanh toán, đổi trạng thái giữa chừng...) hiện ngay trong hộp thoại.
      setServerError(
        getErrorMessage(error, "Không thực hiện được, vui lòng thử lại.")
      )
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {serverError && <Notice tone="error">{serverError}</Notice>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
