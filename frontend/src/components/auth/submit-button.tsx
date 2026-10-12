import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SubmitButton({
  loading,
  disabled = false,
  children,
}: {
  loading: boolean
  disabled?: boolean
  children: string
}) {
  return (
    <Button
      type="submit"
      size="lg"
      disabled={loading || disabled}
      className="w-full"
    >
      {loading && <Loader2 className="animate-spin" />}
      {loading ? "Đang xử lý..." : children}
    </Button>
  )
}
