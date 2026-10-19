import type { ChatErrorCode } from './chat-error';

export interface ChatMessage {
  id: number;
  conversationId: number;
  customerId: number;
  senderId: number;
  fromAdmin: boolean;
  content: string;
  createdAt: Date; // qua socket và REST đều thành chuỗi ISO
}

export type SendAck =
  | { ok: true; message: ChatMessage }
  | { ok: false; code: ChatErrorCode; message: string };

export interface MessagePage {
  items: ChatMessage[]; // từ cũ đến mới
  hasMore: boolean;
}

export interface InboxItem {
  customerId: number;
  fullName: string;
  email: string;
  lastMessage: { content: string; fromAdmin: boolean; createdAt: Date };
  updatedAt: Date;
}

export interface InboxPage {
  items: InboxItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
