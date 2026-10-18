import type { PrismaService } from '../prisma/prisma.service';
import type { UserService } from '../user/user.service';
import { ChatError } from './chat-error';
import { ChatService } from './chat.service';

const NOW = new Date('2026-10-17T03:00:00Z');

function setup() {
  const tx = {
    conversation: { upsert: jest.fn(), update: jest.fn() },
    message: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  const users = { findById: jest.fn() };
  tx.conversation.upsert.mockResolvedValue({ id: 100 });
  tx.conversation.update.mockResolvedValue({ id: 100 });
  tx.message.create.mockImplementation(({ data }) =>
    Promise.resolve({ id: 1, ...data, createdAt: NOW }),
  );
  const service = new ChatService(
    prisma as unknown as PrismaService,
    users as unknown as UserService,
  );
  return { service, tx, prisma, users };
}

const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof ChatError ? e.code : e;
  }
  return null;
};

describe('ChatService.sendMessage', () => {
  it('USER: upsert theo userId của người gửi, bỏ qua customerId do client gửi', async () => {
    const { service, tx, users } = setup();
    const msg = await service.sendMessage({
      senderId: 7,
      role: 'USER',
      content: 'xin chào',
      customerId: 424242,
    });
    expect(tx.conversation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 7 }, create: { userId: 7 } }),
    );
    expect(tx.conversation.update).not.toHaveBeenCalled();
    expect(users.findById).not.toHaveBeenCalled();
    expect(
      JSON.stringify([
        tx.conversation.upsert.mock.calls,
        tx.message.create.mock.calls,
        users.findById.mock.calls,
      ]),
    ).not.toContain('424242');
    expect(msg).toMatchObject({
      id: 1,
      conversationId: 100,
      customerId: 7,
      senderId: 7,
      fromAdmin: false,
      content: 'xin chào',
      createdAt: NOW,
    });
  });

  it('ADMIN thiếu customerId: INVALID_PAYLOAD, không đụng DB', async () => {
    const { service, prisma } = setup();
    expect(
      await codeOf(
        service.sendMessage({ senderId: 1, role: 'ADMIN', content: 'x' }),
      ),
    ).toBe('INVALID_PAYLOAD');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('ADMIN: khách không tồn tại hoặc không phải USER: CUSTOMER_NOT_FOUND', async () => {
    const { service, users, prisma } = setup();
    users.findById.mockResolvedValueOnce(null);
    expect(
      await codeOf(
        service.sendMessage({
          senderId: 1,
          role: 'ADMIN',
          content: 'x',
          customerId: 9,
        }),
      ),
    ).toBe('CUSTOMER_NOT_FOUND');
    users.findById.mockResolvedValueOnce({ id: 2, role: 'ADMIN' });
    expect(
      await codeOf(
        service.sendMessage({
          senderId: 1,
          role: 'ADMIN',
          content: 'x',
          customerId: 2,
        }),
      ),
    ).toBe('CUSTOMER_NOT_FOUND');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('ADMIN: khách chưa có hội thoại: NO_CONVERSATION, không tạo gì', async () => {
    const { service, tx, users } = setup();
    users.findById.mockResolvedValue({ id: 9, role: 'USER' });
    tx.conversation.update.mockRejectedValue({ code: 'P2025' });
    expect(
      await codeOf(
        service.sendMessage({
          senderId: 1,
          role: 'ADMIN',
          content: 'x',
          customerId: 9,
        }),
      ),
    ).toBe('NO_CONVERSATION');
    expect(tx.conversation.upsert).not.toHaveBeenCalled();
    expect(tx.message.create).not.toHaveBeenCalled();
  });

  it('ADMIN hợp lệ: lưu với senderId của admin, fromAdmin = true', async () => {
    const { service, tx, users } = setup();
    users.findById.mockResolvedValue({ id: 9, role: 'USER' });
    const msg = await service.sendMessage({
      senderId: 1,
      role: 'ADMIN',
      content: 'đã nhận',
      customerId: 9,
    });
    expect(tx.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 9 } }),
    );
    expect(tx.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { conversationId: 100, senderId: 1, content: 'đã nhận' },
      }),
    );
    expect(msg).toMatchObject({ customerId: 9, senderId: 1, fromAdmin: true });
  });

  it('lỗi DB khác được ném tiếp nguyên dạng', async () => {
    const { service, tx } = setup();
    tx.message.create.mockRejectedValue(new Error('db down'));
    await expect(
      service.sendMessage({ senderId: 7, role: 'USER', content: 'x' }),
    ).rejects.toThrow('db down');
  });
});
