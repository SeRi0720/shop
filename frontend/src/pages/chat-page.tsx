import { MessageSquare } from "lucide-react"
import { useMemo } from "react"
import { Navigate } from "react-router"
import { toast } from "sonner"
import { APP_NAME } from "@/components/auth/auth-shell"
import { Notice } from "@/components/auth/notice"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/auth-context"
import { flattenMessages } from "@/features/chat/cache"
import { useChatConnection } from "@/features/chat/chat-context"
import { useChatMessages } from "@/features/chat/hooks"
import { MessageComposer } from "@/features/chat/message-composer"
import { MessageList } from "@/features/chat/message-list"
import { getErrorMessage } from "@/lib/api"
import { cn } from "@/lib/utils"

export function ChatPage() {
  const { user } = useAuth()
  if (!user) return null // ProtectedRoute đã chặn; chỉ để thu hẹp kiểu
  // Admin dùng hộp thư riêng (quyết định 15)
  if (user.role === "ADMIN") return <Navigate to="/admin/chat" replace />
  return <CustomerChat userId={user.id} />
}

function CustomerChat({ userId }: { userId: number }) {
  const { connected } = useChatConnection()
  const query = useChatMessages(userId)
  const messages = useMemo(() => flattenMessages(query.data), [query.data])

  function loadOlder() {
    void query.fetchNextPage().then((result) => {
      if (result.isError)
        toast.error("Không tải được tin cũ hơn, vui lòng thử lại")
    })
  }

  return (
    <div className="animate-fade-up space-y-6">
      <h1 className="text-4xl text-display sm:text-5xl">Tin nhắn</h1>

      {/* Chiều cao cố định: chỉ vùng tin nhắn cuộn, không cuộn cả trang */}
      <section
        aria-label={`Trò chuyện với ${APP_NAME}`}
        className="flex h-[calc(100svh-13rem)] min-h-96 flex-col border border-foreground bg-card"
      >
        <div className="flex items-center justify-between border-b border-foreground px-4 py-2.5">
          <p className="label-mono font-bold">Hỗ trợ {APP_NAME}</p>
          <p
            role="status"
            className={cn(
              "label-mono text-[11px]",
              connected ? "text-muted-foreground" : "text-destructive"
            )}
          >
            {connected ? "Đã kết nối" : "Đang kết nối..."}
          </p>
        </div>

        {/* min-h-0: thiếu dòng này thì phần tử flex không co lại và cả trang cuộn */}
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
          ) : messages.length === 0 ? (
            <div className="grid h-full place-items-center p-4">
              <EmptyState
                icon={MessageSquare}
                title="Chưa có tin nhắn"
                description="Hãy nhắn cho chúng tôi, nhân viên sẽ trả lời bạn tại đây."
              />
            </div>
          ) : (
            <MessageList
              messages={messages}
              perspective="customer"
              otherLabel="Hỗ trợ"
              hasMore={query.hasNextPage}
              loadingMore={
                query.isFetchNextPageError ? false : query.isFetchingNextPage
              }
              onLoadMore={loadOlder}
            />
          )}
        </div>

        <MessageComposer connected={connected} />
      </section>
    </div>
  )
}
