import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { UserService } from '../user/user.service';
import { ChatService } from './chat.service';

const T = new Date('2026-10-17T03:00:00Z');

function setup() {
  const prisma = {
    conversation: {
      findUnique: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    message: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const users = { findSummariesByIds: jest.fn() };
  const service = new ChatService(
    prisma as unknown as PrismaService,
    users as unknown as UserService,
  );
  return { service, prisma, users };
}

/** Dòng tin giảm dần theo id, từ `from` xuống `to` (gồm cả hai đầu). */
const rowsDesc = (from: number, to: number, senderId = 7) =>
  Array.from({ length: from - to + 1 }, (_, i) => ({
    id: from - i,
    conversationId: 100,
    senderId,
    content: `tin ${from - i}`,
    createdAt: T,
  }));

describe('ChatService.listOwnMessages', () => {
  it('trang đầu: lấy limit + 1, trả 30 tin từ cũ đến mới, hasMore = true', async () => {
    const { service, prisma } = setup();
    prisma.conversation.findUnique.mockResolvedValue({ id: 100 });
    prisma.message.findMany.mockResolvedValue(rowsDesc(131, 101)); // 31 dòng
    const page = await service.listOwnMessages(7, {});
    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId: 100 },
        orderBy: { id: 'desc' },
        take: 31,
      }),
    );
    expect(page.hasMore).toBe(true);
    expect(page.items).toHaveLength(30);
    expect(page.items[0].id).toBe(102);
    expect(page.items[29].id).toBe(131);
  });

  it('trang giữa: có before thì lọc id < before', async () => {
    const { service, prisma } = setup();
    prisma.conversation.findUnique.mockResolvedValue({ id: 100 });
    prisma.message.findMany.mockResolvedValue(rowsDesc(101, 71));
    await service.listOwnMessages(7, { before: 102 });
    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId: 100, id: { lt: 102 } },
      }),
    );
  });

  it('trang cuối: ít hơn limit thì hasMore = false, vẫn từ cũ đến mới', async () => {
    const { service, prisma } = setup();
    prisma.conversation.findUnique.mockResolvedValue({ id: 100 });
    prisma.message.findMany.mockResolvedValue(rowsDesc(5, 1));
    const page = await service.listOwnMessages(7, { before: 6 });
    expect(page.hasMore).toBe(false);
    expect(page.items.map((m) => m.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('đúng limit tin thì không có trang cũ hơn (hasMore = false)', async () => {
    const { service, prisma } = setup();
    prisma.conversation.findUnique.mockResolvedValue({ id: 100 });
    prisma.message.findMany.mockResolvedValue(rowsDesc(30, 1)); // đúng 30
    expect((await service.listOwnMessages(7, {})).hasMore).toBe(false);
  });

  it('limit vượt mức bị kẹp về 100', async () => {
    const { service, prisma } = setup();
    prisma.conversation.findUnique.mockResolvedValue({ id: 100 });
    prisma.message.findMany.mockResolvedValue([]);
    await service.listOwnMessages(7, { limit: 500 });
    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 101 }),
    );
  });

  it('chỉ đọc hội thoại của chính người gọi; fromAdmin suy ra từ senderId', async () => {
    const { service, prisma } = setup();
    prisma.conversation.findUnique.mockResolvedValue({ id: 100 });
    prisma.message.findMany.mockResolvedValue([
      ...rowsDesc(3, 3, 1), // admin (senderId 1)
      ...rowsDesc(2, 1, 7), // khách
    ]);
    const page = await service.listOwnMessages(7, {});
    expect(prisma.conversation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 7 } }),
    );
    expect(page.items.every((m) => m.customerId === 7)).toBe(true);
    expect(page.items.map((m) => m.fromAdmin)).toEqual([false, false, true]);
  });

  it('chưa có hội thoại: trang rỗng, không truy vấn tin', async () => {
    const { service, prisma } = setup();
    prisma.conversation.findUnique.mockResolvedValue(null);
    expect(await service.listOwnMessages(7, {})).toEqual({
      items: [],
      hasMore: false,
    });
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });
});

describe('ChatService.listConversationMessages (admin)', () => {
  it('đọc theo customerId được truyền vào', async () => {
    const { service, prisma } = setup();
    prisma.conversation.findUnique.mockResolvedValue({ id: 200 });
    prisma.message.findMany.mockResolvedValue([]);
    await service.listConversationMessages(9, {});
    expect(prisma.conversation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 9 } }),
    );
    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { conversationId: 200 } }),
    );
  });

  it('khách chưa có hội thoại: 404, không truy vấn tin', async () => {
    const { service, prisma } = setup();
    prisma.conversation.findUnique.mockResolvedValue(null);
    await expect(
      service.listConversationMessages(9, {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });
});

describe('ChatService.listConversations', () => {
  const summaries = new Map([
    [3, { id: 3, fullName: 'Cường', email: 'c@x.vn' }],
    [2, { id: 2, fullName: 'Bình', email: 'b@x.vn' }],
  ]);

  it('sắp theo hoạt động mới nhất, tin cuối đúng từng hội thoại, một lời gọi lấy tên', async () => {
    const { service, prisma, users } = setup();
    prisma.conversation.count.mockResolvedValue(45);
    prisma.conversation.findMany.mockResolvedValue([
      { id: 11, userId: 3, updatedAt: new Date('2026-10-17T05:00:00Z') },
      { id: 10, userId: 2, updatedAt: new Date('2026-10-17T04:00:00Z') },
    ]);
    // thứ tự trả về khác thứ tự trang, để chắc việc ghép theo id
    prisma.$queryRaw.mockResolvedValue([
      {
        conversationId: 10,
        senderId: 1,
        content: 'a'.repeat(300),
        createdAt: T,
      },
      { conversationId: 11, senderId: 3, content: 'chào shop', createdAt: T },
    ]);
    users.findSummariesByIds.mockResolvedValue(summaries);

    const page = await service.listConversations({});

    expect(prisma.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { messages: { some: {} } },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: 0,
        take: 20,
      }),
    );
    expect(page).toMatchObject({
      total: 45,
      page: 1,
      limit: 20,
      totalPages: 3,
    });
    expect(page.items.map((i) => i.customerId)).toEqual([3, 2]);
    expect(page.items[0]).toMatchObject({
      fullName: 'Cường',
      email: 'c@x.vn',
      lastMessage: { content: 'chào shop', fromAdmin: false },
    });
    expect(page.items[1].lastMessage.fromAdmin).toBe(true);
    expect(page.items[1].lastMessage.content).toHaveLength(120);
    expect(users.findSummariesByIds).toHaveBeenCalledTimes(1);
    expect(users.findSummariesByIds).toHaveBeenCalledWith([3, 2]);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('cắt tin cuối theo ký tự, không tách đôi emoji', async () => {
    const { service, prisma, users } = setup();
    prisma.conversation.count.mockResolvedValue(1);
    prisma.conversation.findMany.mockResolvedValue([
      { id: 11, userId: 3, updatedAt: T },
    ]);
    prisma.$queryRaw.mockResolvedValue([
      {
        conversationId: 11,
        senderId: 3,
        content: '😀'.repeat(200),
        createdAt: T,
      },
    ]);
    users.findSummariesByIds.mockResolvedValue(summaries);
    const { items } = await service.listConversations({});
    expect(Array.from(items[0].lastMessage.content)).toHaveLength(120);
  });

  it('trang 3, limit 20 thì skip 40; limit vượt mức bị kẹp về 50', async () => {
    const { service, prisma } = setup();
    prisma.conversation.count.mockResolvedValue(0);
    prisma.conversation.findMany.mockResolvedValue([]);
    await service.listConversations({ page: 3, limit: 20 });
    expect(prisma.conversation.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ skip: 40, take: 20 }),
    );
    await service.listConversations({ limit: 500 });
    expect(prisma.conversation.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it('không có hội thoại: trang rỗng, không truy vấn tin cuối và không lấy tên', async () => {
    const { service, prisma, users } = setup();
    prisma.conversation.count.mockResolvedValue(0);
    prisma.conversation.findMany.mockResolvedValue([]);
    const page = await service.listConversations({});
    expect(page).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(users.findSummariesByIds).not.toHaveBeenCalled();
  });
});
