import { Loader2 } from "lucide-react"
import { useLayoutEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "./types"

/** customer: "mình" là tin không phải admin. admin: "mình" là tin của admin. */
export type Perspective = "customer" | "admin"

const NEAR_BOTTOM_PX = 80

const isOwn = (m: ChatMessage, perspective: Perspective) =>
  perspective === "admin" ? m.fromAdmin : !m.fromAdmin

interface Snapshot {
  firstId: number | null
  lastId: number | null
  height: number
}

export function MessageList({
  messages,
  perspective,
  otherLabel,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  messages: ChatMessage[]
  perspective: Perspective
  /** Khách thấy "Hỗ trợ", admin thấy tên khách. */
  otherLabel: string
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const snapshot = useRef<Snapshot | null>(null)

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const firstId = messages[0]?.id ?? null
    const last = messages[messages.length - 1]
    const lastId = last?.id ?? null
    const prev = snapshot.current

    if (!prev) {
      el.scrollTop = el.scrollHeight // lần đầu: xuống cuối
    } else if (lastId !== prev.lastId) {
      // Có tin mới ở cuối: chỉ cuộn khi đang ở gần cuối hoặc đó là tin của mình
      const mine = last !== undefined && isOwn(last, perspective)
      if (stickToBottom.current || mine) el.scrollTop = el.scrollHeight
    } else if (firstId !== prev.firstId) {
      // Thêm (hoặc bớt) tin ở đầu: giữ nguyên tin đang đọc
      el.scrollTop += el.scrollHeight - prev.height
    }
    snapshot.current = { firstId, lastId, height: el.scrollHeight }
  }, [messages, perspective])

  function handleScroll() {
    const el = scroller.current
    if (!el) return
    stickToBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
  }

  return (
    <div
      ref={scroller}
      onScroll={handleScroll}
      className="h-full overflow-y-auto overscroll-contain p-4"
    >
      {hasMore && (
        <div className="mb-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore && <Loader2 className="animate-spin" />}
            Tải tin cũ hơn
          </Button>
        </div>
      )}
      {/* role="log" ngầm là aria-live polite: trình đọc màn hình đọc tin mới */}
      <ul role="log" aria-label="Cuộc trò chuyện" className="space-y-3">
        {messages.map((m) => {
          const own = isOwn(m, perspective)
          return (
            <li
              key={m.id}
              className={cn(
                "flex flex-col gap-1",
                own ? "items-end" : "items-start"
              )}
            >
              <span className="label-mono text-[10px] text-muted-foreground">
                {own ? "Bạn" : otherLabel} · {formatDateTime(m.createdAt)}
              </span>
              {/* Văn bản thuần: React tự escape, tuyệt đối không dùng dangerouslySetInnerHTML */}
              <p
                className={cn(
                  "max-w-[85%] border border-foreground px-3 py-2 text-sm wrap-break-word whitespace-pre-wrap sm:max-w-[70%]",
                  own
                    ? "bg-foreground text-background"
                    : "bg-card text-card-foreground"
                )}
              >
                {m.content}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
