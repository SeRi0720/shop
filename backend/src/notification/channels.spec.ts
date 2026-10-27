import { describe, expect, it, jest } from '@jest/globals';
import { buildEnvelope } from '../kafka/events';
import { LogChannel } from './log.channel';
import {
  KIND_ADMIN_NEW_ORDER,
  NOTIFICATION,
  type NotificationData,
} from './notification.events';
import { SOCKET_EVENT, SocketChannel } from './socket.channel';

const event = buildEnvelope<NotificationData>(
  NOTIFICATION,
  {
    kind: KIND_ADMIN_NEW_ORDER,
    causationId: 'src',
    orderId: 5,
    totalAmount: 12_500_000,
    paymentMethod: 'COD',
  },
  { eventId: 'src:admin-new-order', now: new Date('2026-11-02T08:00:00.000Z') },
);

describe('SocketChannel', () => {
  it('phát notification:new tới admin với đúng payload mà frontend đọc', async () => {
    const emitToAdmins = jest.fn();
    await new SocketChannel({ emitToAdmins }).send(event);
    expect(SOCKET_EVENT).toBe('notification:new');
    expect(emitToAdmins).toHaveBeenCalledTimes(1);
    expect(emitToAdmins).toHaveBeenCalledWith('notification:new', {
      eventId: 'src:admin-new-order',
      kind: KIND_ADMIN_NEW_ORDER,
      orderId: 5,
      totalAmount: 12_500_000,
      paymentMethod: 'COD',
      occurredAt: '2026-11-02T08:00:00.000Z',
    });
  });

  it('emitToAdmins ném lỗi thì lỗi nổi lên (nấc 2 sẽ retry)', async () => {
    const channel = new SocketChannel({
      emitToAdmins: () => {
        throw new Error('Socket server chưa khởi tạo');
      },
    });
    expect(() => channel.send(event)).toThrow('Socket server chưa khởi tạo');
  });
});

describe('LogChannel', () => {
  it('ghi một dòng JSON có eventId và orderId, không có thông tin cá nhân', async () => {
    const channel = new LogChannel();
    const spy = jest
      .spyOn(
        (channel as unknown as { logger: { log: (m: string) => void } }).logger,
        'log',
      )
      .mockImplementation(() => undefined);
    await channel.send(event);
    const line = JSON.parse(spy.mock.calls[0][0]) as Record<string, unknown>;
    expect(line).toMatchObject({
      channel: 'log',
      eventId: 'src:admin-new-order',
      orderId: 5,
    });
    expect(JSON.stringify(line)).not.toMatch(/phone|address|fullName|email/i);
  });
});
