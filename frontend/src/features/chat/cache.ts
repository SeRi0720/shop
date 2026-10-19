import type { InfiniteData, QueryClient } from "@tanstack/react-query"
import type {
  ChatMessage,
  InboxItem,
  InboxPage,
  InboxParams,
  MessagePage,
} from "./types"

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
  data: { pages: MessagePage[] } | undefined
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
  patchInboxes(qc, viewerId, message)
}

/** Hộp thư: sửa tại chỗ nếu dòng đang ở trang 1, ngược lại tải lại trang đó. */
function patchInboxes(qc: QueryClient, viewerId: number, message: ChatMessage) {
  for (const [key, data] of qc.getQueriesData<InboxPage>({
    queryKey: ["chat", viewerId, "inbox"],
  })) {
    const params = key[3] as InboxParams | undefined
    const row = data?.items.find((r) => r.customerId === message.customerId)
    if (data && row && (params?.page ?? 1) === 1) {
      const updated: InboxItem = {
        ...row,
        lastMessage: {
          content: message.content.slice(0, 120), // khớp backend (cắt 120 ký tự)
          fromAdmin: message.fromAdmin,
          createdAt: message.createdAt,
        },
        updatedAt: message.createdAt,
      }
      qc.setQueryData<InboxPage>(key, {
        ...data,
        items: [updated, ...data.items.filter((r) => r !== row)],
      })
    } else {
      void qc.invalidateQueries({ queryKey: key, exact: true })
    }
  }
}

/** Tìm tên và email khách trong mọi trang hộp thư đã có trong cache (để hiện ở đầu khung chat). */
export function findCachedCustomer(
  qc: QueryClient,
  viewerId: number,
  customerId: number
): InboxItem | undefined {
  for (const [, data] of qc.getQueriesData<InboxPage>({
    queryKey: ["chat", viewerId, "inbox"],
  })) {
    const hit = data?.items.find((c) => c.customerId === customerId)
    if (hit) return hit
  }
  return undefined
}

/**
 * Sau khi nối lại: Socket.IO không phát lại tin bị lỡ nên phải đọc lại từ DB.
 * Cắt về trang mới nhất TRƯỚC khi tải lại. Nếu chỉ invalidate, TanStack tải lại
 * từng trang với con trỏ `before` cũ; tin mới làm trang 0 đẩy lùi, các tin ở
 * giữa trang 0 và trang 1 bị hụt và biến mất khỏi danh sách.
 */
export function resyncChat(qc: QueryClient, viewerId: number) {
  void qc.invalidateQueries({ queryKey: ["chat", viewerId] })
}
