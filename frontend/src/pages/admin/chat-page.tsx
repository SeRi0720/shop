import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, MessageSquare, MessageSquareOff } from "lucide-react"
import { useEffect, useMemo } from "react"
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
  type To,
} from "react-router"
import { toast } from "sonner"
import { Notice } from "@/components/auth/notice"
import { EmptyState } from "@/components/empty-state"
import { SimplePagination } from "@/components/simple-pagination"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/auth-context"
import { findCachedCustomer, flattenMessages } from "@/features/chat/cache"
import { useChatConnection } from "@/features/chat/chat-context"
import { ConversationList } from "@/features/chat/conversation-list"
import { useChatMessages, useInbox } from "@/features/chat/hooks"
import { MessageComposer } from "@/features/chat/message-composer"
import { MessageList } from "@/features/chat/message-list"
import type { InboxItem } from "@/features/chat/types"
import { getErrorMessage, isNotFound } from "@/lib/api"
import { parseId } from "@/lib/parse-id"
import { cn } from "@/lib/utils"
import { setActiveConversation, useUnread } from "@/features/chat/unread"

const PAGE_SIZE = 20

const pane = "min-h-0 flex-col border border-foreground bg-card"

export function AdminChatPage() {
  const { customerId: rawId } = useParams()
  const hasSelection = rawId !== undefined
  const customerId = hasSelection ? parseId(rawId) : null // null khi có id nhưng sai dạng
  const { search } = useLocation()
  const [sp, setSearchParams] = useSearchParams()
  const rawPage = Number(sp.get("page"))
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1

  const { user } = useAuth()
  const qc = useQueryClient()
  const inbox = useInbox({ page, limit: PAGE_SIZE })
  const customer =
    customerId !== null && user
      ? findCachedCustomer(qc, user.id, customerId)
      : undefined
  const backTo: To = { pathname: "/admin/chat", search }

  const unread = useUnread()
  useEffect(() => {
    setActiveConversation(customerId)
    return () => setActiveConversation(null)
  }, [customerId])

  function goToPage(next: number) {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      p.set("page", String(next))
      return p
    })
  }

  return (
    <div className="animate-fade-up">
      <h1 className="sr-only">Tin nhắn</h1>

      {/* Chiều cao cố định để chỉ vùng tin nhắn cuộn. Số rem là ước lượng từ
          header (4rem), menu ngang trên điện thoại và padding của AdminLayout. */}
      <div className="grid h-[calc(100svh-10rem)] min-h-96 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-4 md:h-[calc(100svh-8rem)] md:grid-cols-[20rem_minmax(0,1fr)]">
        {/* Cột trái: hộp thư */}
        <section
          aria-label="Danh sách hội thoại"
          className={cn(pane, hasSelection ? "hidden md:flex" : "flex")}
        >
          <div className="flex items-center border-b border-foreground px-4 py-2.5">
            <p className="label-mono font-bold">Hộp thư</p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {inbox.data === undefined && inbox.isError ? (
              <div className="space-y-3 p-4">
                <Notice tone="error">
                  {getErrorMessage(inbox.error, "Không tải được hộp thư.")}
                </Notice>
                <Button variant="outline" onClick={() => void inbox.refetch()}>
                  Thử lại
                </Button>
              </div>
            ) : inbox.data === undefined ? (
              <div className="space-y-px">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : inbox.data.items.length === 0 ? (
              <div className="p-4">
                {inbox.data.total > 0 ? (
                  <EmptyState
                    icon={MessageSquare}
                    title="Trang này không có hội thoại"
                  >
                    <Button variant="outline" onClick={() => goToPage(1)}>
                      Về trang 1
                    </Button>
                  </EmptyState>
                ) : (
                  <EmptyState
                    icon={MessageSquare}
                    title="Chưa có hội thoại nào"
                    description="Khi khách nhắn tin, hội thoại sẽ hiện ở đây."
                  />
                )}
              </div>
            ) : (
              <div
                className={cn(
                  "transition-opacity",
                  inbox.isPlaceholderData && "opacity-60"
                )}
              >
                <ConversationList
                  items={inbox.data.items}
                  activeId={customerId}
                  search={search}
                  unread={unread}
                />
              </div>
            )}
          </div>

          {inbox.data && inbox.data.totalPages > 1 && (
            <div className="border-t border-foreground p-3">
              <SimplePagination
                page={inbox.data.page}
                totalPages={inbox.data.totalPages}
                summary={`${inbox.data.total} hội thoại`}
                onPageChange={goToPage}
              />
            </div>
          )}
        </section>

        {/* Cột phải: khung hội thoại */}
        <section
          aria-label="Cuộc hội thoại"
          className={cn(pane, hasSelection ? "flex" : "hidden md:flex")}
        >
          {!hasSelection ? (
            <div className="grid h-full place-items-center p-4">
              <EmptyState
                icon={MessageSquare}
                title="Chọn một hội thoại"
                description="Chọn khách ở danh sách bên trái để xem và trả lời tin nhắn."
              />
            </div>
          ) : customerId === null ? (
            <NotFound backTo={backTo} />
          ) : (
            <AdminThread
              key={customerId}
              customerId={customerId}
              customer={customer}
              backTo={backTo}
            />
          )}
        </section>
      </div>
    </div>
  )
}

function NotFound({ backTo }: { backTo: To }) {
  return (
    <div className="grid h-full place-items-center p-4">
      <EmptyState
        icon={MessageSquareOff}
        title="Không tìm thấy hội thoại"
        description="Khách này chưa nhắn tin hoặc không tồn tại."
      >
        <Button asChild variant="outline">
          <Link to={backTo}>
            <ArrowLeft />
            Về hộp thư
          </Link>
        </Button>
      </EmptyState>
    </div>
  )
}

function AdminThread({
  customerId,
  customer,
  backTo,
}: {
  customerId: number
  customer: InboxItem | undefined
  backTo: To
}) {
  const { connected } = useChatConnection()
  const query = useChatMessages(customerId)
  const messages = useMemo(() => flattenMessages(query.data), [query.data])
  const name = customer?.fullName ?? `Khách #${customerId}`

  // Khách chưa có hội thoại: backend trả 404, không hiện ô nhập (admin không chủ động mở hội thoại)
  if (isNotFound(query.error)) return <NotFound backTo={backTo} />

  function loadOlder() {
    void query.fetchNextPage().then((result) => {
      if (result.isError)
        toast.error("Không tải được tin cũ hơn, vui lòng thử lại")
    })
  }

  return (
    <>
      <div className="flex items-center gap-2 border-b border-foreground px-3 py-2.5">
        <Button asChild variant="ghost" size="icon-sm" className="md:hidden">
          <Link to={backTo} aria-label="Về hộp thư">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-bold">{name}</p>
          {customer && (
            <p className="truncate label-mono text-[10px] text-muted-foreground">
              {customer.email}
            </p>
          )}
        </div>
        <p
          role="status"
          className={cn(
            "shrink-0 label-mono text-[11px]",
            connected ? "text-muted-foreground" : "text-destructive"
          )}
        >
          {connected ? "Đã kết nối" : "Đang kết nối..."}
        </p>
      </div>

      <div className="min-h-0 flex-1">
        {query.data === undefined && query.isError ? (
          <div className="space-y-3 p-4">
            <Notice tone="error">
              {getErrorMessage(query.error, "Không tải được tin nhắn.")}
            </Notice>
            <Button variant="outline" onClick={() => void query.refetch()}>
              Thử lại
            </Button>
          </div>
        ) : query.data === undefined ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="ml-auto h-10 w-1/2" />
            <Skeleton className="h-10 w-3/5" />
          </div>
        ) : (
          <MessageList
            messages={messages}
            perspective="admin"
            otherLabel={name}
            hasMore={query.hasNextPage}
            loadingMore={
              query.isFetchNextPageError ? false : query.isFetchingNextPage
            }
            onLoadMore={loadOlder}
          />
        )}
      </div>

      <MessageComposer connected={connected} customerId={customerId} />
    </>
  )
}
