import { Loader2, SendHorizontal } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useSendMessage } from "./hooks"
import { SendFailure } from "./send-message"

const MAX_LENGTH = 2000 // khớp MAX_CONTENT_LENGTH ở backend (cùng đếm theo string.length)
const COUNTER_FROM = 1800

export function MessageComposer({
  connected,
  customerId,
}: {
  connected: boolean
  /** Chỉ admin truyền (ngày 6); khách để trống. */
  customerId?: number
}) {
  const [value, setValue] = useState("")
  const send = useSendMessage()
  const content = value.trim()
  const canSend = connected && content.length > 0 && !send.isPending

  function submit() {
    if (!canSend) return
    send.mutate(
      { content, customerId },
      {
        // Chỉ xóa ô nếu người dùng chưa gõ thêm gì trong lúc chờ ack
        onSuccess: () =>
          setValue((current) => (current.trim() === content ? "" : current)),
        // Giữ nguyên nội dung để gửi lại
        onError: (error) => {
          const failure = error instanceof SendFailure ? error : null
          toast.error(
            failure?.message ?? "Không gửi được tin, vui lòng thử lại",
            { duration: failure?.code === "TIMEOUT" ? 8000 : undefined }
          )
        },
      }
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="flex items-end gap-2 border-t border-foreground p-3"
    >
      <div className="min-w-0 flex-1">
        <label htmlFor="chat-input" className="sr-only">
          Nội dung tin nhắn
        </label>
        {/* Không disable ô nhập khi mất kết nối: nội dung đang gõ không bị mất */}
        <Textarea
          id="chat-input"
          rows={1}
          maxLength={MAX_LENGTH}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // Enter gửi, Shift+Enter xuống dòng; đang gõ dở bằng bộ gõ thì không gửi
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Nhập tin nhắn..."
          className="field-sizing-content max-h-40 min-h-11 resize-none"
        />
        {value.length >= COUNTER_FROM && (
          <p className="mt-1 text-right label-mono text-[10px] text-muted-foreground">
            {value.length}/{MAX_LENGTH}
          </p>
        )}
      </div>
      <Button type="submit" disabled={!canSend} className="h-11">
        {send.isPending ? (
          <Loader2 className="animate-spin" />
        ) : (
          <SendHorizontal />
        )}
        Gửi
      </Button>
    </form>
  )
}
