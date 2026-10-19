import type { InfiniteData, QueryClient } from "@tanstack/react-query"
import type { ChatMessage, InboxParams, MessagePage } from "./types"

// pages[0] là trang MỚI NHẤT; các trang sau cũ dần. Trong mỗi trang, tin xếp từ cũ đến mới.
export type MessagesData = InfiniteData<MessagePage, number | undefined>

export const chatMessagesKey = (
  viewerId: number | undefined,
  customerId: number | null
) => ["chat", viewerId, "messages", customerId] as const

export const chatInboxKey = (
  viewerId: number | undefined,
  params: InboxParams
) => ["chat", viewerId, "inbox", params] as const

/** Ghép các trang thành một danh sách từ cũ đến mới. */
export const flattenMessages = (
  data: MessagesData | undefined
): ChatMessage[] =>
  data ? [...data.pages].reverse().flatMap((p) => p.items) : []

/** Tin mới (từ socket hoặc từ ack): ghi vào cache theo id, ghi lại cùng id thì bỏ qua. */
export function applyIncomingMessage(
  qc: QueryClient,
  viewerId: number,
  message: ChatMessage
) {
  const key = chatMessagesKey(viewerId, message.customerId)
  const data = qc.getQueryData<MessagesData>(key)
  if (data) {
    const exists = data.pages.some((p) =>
      p.items.some((m) => m.id === message.id)
    )
    const [newest, ...older] = data.pages
    if (!exists && newest) {
      qc.setQueryData<MessagesData>(key, {
        ...data,
        pages: [{ ...newest, items: [...newest.items, message] }, ...older],
      })
    }
  } else {
    // Chưa có dữ liệu (đang tải lần đầu hoặc chưa mở khung): tải lại để không lỡ tin này.
    void qc.invalidateQueries({ queryKey: key })
  }
  // Hộp thư admin: ngày 6 sẽ tối ưu (cập nhật tại chỗ); hiện tải lại cho đúng.
  void qc.invalidateQueries({ queryKey: ["chat", viewerId, "inbox"] })
}

/**
 * Sau khi nối lại: Socket.IO không phát lại tin bị lỡ nên phải đọc lại từ DB.
 * Cắt về trang mới nhất TRƯỚC khi tải lại. Nếu chỉ invalidate, TanStack tải lại
 * từng trang với con trỏ `before` cũ; tin mới làm trang 0 đẩy lùi, các tin ở
 * giữa trang 0 và trang 1 bị hụt và biến mất khỏi danh sách.
 */
export function resyncChat(qc: QueryClient, viewerId: number) {
  qc.setQueriesData<MessagesData>(
    { queryKey: ["chat", viewerId, "messages"] },
    (data) =>
      data && {
        pages: data.pages.slice(0, 1),
        pageParams: data.pageParams.slice(0, 1),
      }
  )
  void qc.invalidateQueries({ queryKey: ["chat", viewerId] })
}
