export type ChatErrorCode =
  | "INVALID_PAYLOAD"
  | "INVALID_CONTENT"
  | "NO_CONVERSATION"
  | "CUSTOMER_NOT_FOUND"
  | "RATE_LIMITED"
  | "TOKEN_EXPIRED"
  | "INTERNAL"

// Đối chiếu với backend/src/chat/chat.types.ts (createdAt qua JSON là chuỗi ISO).
export interface ChatMessage {
  id: number
  conversationId: number
  customerId: number
  senderId: number
  fromAdmin: boolean
  content: string
  createdAt: string
}

export type SendAck =
  | { ok: true; message: ChatMessage }
  | { ok: false; code: ChatErrorCode; message: string }

export interface MessagePage {
  items: ChatMessage[] // từ cũ đến mới
  hasMore: boolean
}

export interface InboxItem {
  customerId: number
  fullName: string
  email: string
  lastMessage: { content: string; fromAdmin: boolean; createdAt: string }
  updatedAt: string
}

export interface InboxPage {
  items: InboxItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface HistoryParams {
  before?: number
  limit?: number
}
export interface InboxParams {
  page?: number
  limit?: number
}
export interface SendInput {
  content: string
  customerId?: number // chỉ ADMIN cần
}
