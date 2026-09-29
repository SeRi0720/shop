import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SubmitButton({
  loading,
  children,
}: {
  loading: boolean
  children: string
}) {
  return (
    <Button
      type="submit"
      size="lg"
      disabled={loading}
      className="h-11 w-full bg-brand-gradient text-white shadow-lg shadow-brand-from/30 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-from/40 hover:brightness-110 active:translate-y-0 active:scale-[0.98]"
    >
      {loading && <Loader2 className="animate-spin" />}
      {loading ? "Đang xử lý..." : children}
    </Button>
  )
}
