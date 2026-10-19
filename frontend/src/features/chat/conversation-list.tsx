import { Link } from "react-router"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { InboxItem } from "./types"

const NONE: ReadonlySet<number> = new Set()

export function ConversationList({
  items,
  activeId,
  search,
  unread = NONE,
}: {
  items: InboxItem[]
  activeId: number | null
  /** location.search hiện tại, để giữ ?page= khi chuyển hội thoại. */
  search: string
  unread?: ReadonlySet<number>
}) {
  return (
    <ul>
      {items.map((c) => {
        const active = c.customerId === activeId
        return (
          <li key={c.customerId} className="border-b border-foreground/25">
            <Link
              to={{ pathname: `/admin/chat/${c.customerId}`, search }}
              aria-current={active ? "true" : undefined}
              className={cn(
                "block px-4 py-3 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground",
                active ? "bg-foreground text-background" : "hover:bg-muted"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-2 font-bold">
                  {unread.has(c.customerId) && (
                    <span
                      role="img"
                      aria-label="Có tin mới"
                      className="size-2 shrink-0 rounded-full bg-current"
                    />
                  )}
                  <span className="truncate">{c.fullName}</span>
                </p>
                <span className="shrink-0 label-mono text-[10px] opacity-70">
                  {formatDateTime(c.lastMessage.createdAt)}
                </span>
              </div>
              {/* Văn bản thuần, React tự escape */}
              <p
                className={cn(
                  "mt-1 line-clamp-1 text-sm",
                  active ? "opacity-80" : "text-muted-foreground"
                )}
              >
                {c.lastMessage.fromAdmin && "Bạn: "}
                {c.lastMessage.content}
              </p>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
