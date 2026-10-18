import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { ChatError } from './chat-error';
import type { ChatMessage } from './chat.types';

export interface SendMessageInput {
  senderId: number;
  role: 'USER' | 'ADMIN';
  content: string;
  customerId?: number; // chỉ ADMIN dùng; với USER luôn bị bỏ qua
}

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
    return {
      id: saved.id,
      conversationId: saved.conversationId,
      customerId,
      senderId: saved.senderId,
      fromAdmin: saved.senderId !== customerId, // không thêm cột
      content: saved.content,
      createdAt: saved.createdAt,
    };
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
        // USER: tạo hội thoại nếu chưa có (upsert gốc).
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
}
