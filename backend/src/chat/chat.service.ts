import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { ChatError } from './chat-error';
import { toChatMessage } from './chat.mapper';
import type { ChatMessage, InboxPage, MessagePage } from './chat.types';

export interface SendMessageInput {
  senderId: number;
  role: 'USER' | 'ADMIN';
  content: string;
  customerId?: number; // chỉ ADMIN dùng; với USER luôn bị bỏ qua
}

const DEFAULT_HISTORY_LIMIT = 30;
const MAX_HISTORY_LIMIT = 100;
const DEFAULT_INBOX_LIMIT = 20;
const MAX_INBOX_LIMIT = 50;
const PREVIEW_LENGTH = 120;

interface LastMessageRow {
  conversationId: number;
  senderId: number;
  content: string;
  createdAt: Date;
}

/** Cắt theo ký tự (không tách đôi emoji), không thêm "…": giao diện tự cắt dòng. */
const preview = (content: string) => {
  const chars = Array.from(content);
  return chars.length > PREVIEW_LENGTH
    ? chars.slice(0, PREVIEW_LENGTH).join('')
    : content;
};

const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  content: true,
  createdAt: true,
} as const;

const hasPrismaCode = (error: unknown, code: string) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === code;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UserService,
  ) {}

  async sendMessage(input: SendMessageInput): Promise<ChatMessage> {
    const customerId = await this.resolveCustomerId(input);
    const saved = await this.store(input, customerId);
    return toChatMessage(saved, customerId);
  }

  /** USER: chỉ đọc hội thoại của chính mình. Chưa từng nhắn thì trả trang rỗng. */
  async listOwnMessages(
    userId: number,
    query: { before?: number; limit?: number },
  ): Promise<MessagePage> {
    const conversationId = await this.findConversationId(userId);
    if (conversationId === null) return { items: [], hasMore: false };
    return this.readPage(conversationId, userId, query);
  }

  /** ADMIN: đọc hội thoại của một khách. Khách chưa có hội thoại thì 404. */
  async listConversationMessages(
    customerId: number,
    query: { before?: number; limit?: number },
  ): Promise<MessagePage> {
    const conversationId = await this.findConversationId(customerId);
    if (conversationId === null) {
      throw new NotFoundException('Không tìm thấy hội thoại');
    }
    return this.readPage(conversationId, customerId, query);
  }

  /** Hộp thư admin: hội thoại đã có tin, mới hoạt động nhất lên đầu. */
  async listConversations(query: {
    page?: number;
    limit?: number;
  }): Promise<InboxPage> {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(
      Math.max(query.limit ?? DEFAULT_INBOX_LIMIT, 1),
      MAX_INBOX_LIMIT,
    );
    // Chỉ hội thoại đã có ít nhất một tin
    const where: Prisma.ConversationWhereInput = { messages: { some: {} } };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], // id làm khóa phụ cho ổn định
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, userId: true, updatedAt: true },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    if (rows.length === 0) return { items: [], total, page, limit, totalPages };

    const last = await this.findLastMessages(rows.map((r) => r.id));
    const users = await this.users.findSummariesByIds(
      rows.map((r) => r.userId),
    );

    const items = rows.flatMap((row) => {
      const lastMessage = last.get(row.id);
      if (!lastMessage) return []; // không thể xảy ra vì đã lọc "có tin"; phòng thủ
      const user = users.get(row.userId);
      return [
        {
          customerId: row.userId,
          fullName: user?.fullName ?? '(không rõ)',
          email: user?.email ?? '',
          lastMessage: {
            content: preview(lastMessage.content),
            fromAdmin: lastMessage.senderId !== row.userId,
            createdAt: lastMessage.createdAt,
          },
          updatedAt: row.updatedAt,
        },
      ];
    });
    return { items, total, page, limit, totalPages };
  }

  /** USER: id của chính mình. ADMIN: customerId bắt buộc, phải là một USER có thật. */
  private async resolveCustomerId(input: SendMessageInput): Promise<number> {
    if (input.role === 'USER') return input.senderId;
    if (input.customerId === undefined) throw new ChatError('INVALID_PAYLOAD');
    const customer = await this.users.findById(input.customerId);
    if (!customer || customer.role !== 'USER') {
      throw new ChatError('CUSTOMER_NOT_FOUND');
    }
    return customer.id;
  }

  private async store(input: SendMessageInput, customerId: number) {
    const isAdmin = input.role === 'ADMIN';
    try {
      return await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        // USER: tạo hội thoại nếu chưa có (upsert gốc, quyết định 9).
        // ADMIN: chỉ cập nhật; chưa có thì P2025, không bao giờ tạo hội thoại.
        const conversation = isAdmin
          ? await tx.conversation.update({
              where: { userId: customerId },
              data: { updatedAt: now },
              select: { id: true },
            })
          : await tx.conversation.upsert({
              where: { userId: customerId },
              create: { userId: customerId },
              update: { updatedAt: now },
              select: { id: true },
            });
        return tx.message.create({
          data: {
            conversationId: conversation.id,
            senderId: input.senderId,
            content: input.content,
          },
          select: {
            id: true,
            conversationId: true,
            senderId: true,
            content: true,
            createdAt: true,
          },
        });
      });
    } catch (error) {
      if (isAdmin && hasPrismaCode(error, 'P2025')) {
        throw new ChatError('NO_CONVERSATION');
      }
      throw error;
    }
  }

  private async findConversationId(userId: number): Promise<number | null> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { userId },
      select: { id: true },
    });
    return conversation?.id ?? null;
  }

  private async readPage(
    conversationId: number,
    customerId: number,
    query: { before?: number; limit?: number },
  ): Promise<MessagePage> {
    // DTO đã chặn quá 100; kẹp thêm ở đây để gọi trực tiếp từ nơi khác cũng an toàn
    const limit = Math.min(
      Math.max(query.limit ?? DEFAULT_HISTORY_LIMIT, 1),
      MAX_HISTORY_LIMIT,
    );
    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(query.before !== undefined ? { id: { lt: query.before } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit + 1, // dòng dư chỉ để biết còn trang cũ hơn
      select: messageSelect,
    });
    const hasMore = rows.length > limit;
    const items = rows
      .slice(0, limit)
      .reverse() // trả từ cũ đến mới
      .map((row) => toChatMessage(row, customerId));
    return { items, hasMore };
  }

  /** Tin cuối của nhiều hội thoại bằng MỘT truy vấn (DISTINCT ON), tránh N+1. */
  private async findLastMessages(conversationIds: number[]) {
    const rows = await this.prisma.$queryRaw<LastMessageRow[]>`
      SELECT DISTINCT ON (conversation_id)
             conversation_id AS "conversationId",
             sender_id       AS "senderId",
             content,
             created_at      AS "createdAt"
      FROM messages
      WHERE conversation_id IN (${Prisma.join(conversationIds)})
      ORDER BY conversation_id, id DESC`;
    return new Map(rows.map((r) => [r.conversationId, r]));
  }
}
