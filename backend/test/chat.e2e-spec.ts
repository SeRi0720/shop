import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { CHAT_PATH } from '../src/chat/chat.constants';
import { ChatModule } from '../src/chat/chat.module';
import type { ChatMessage, MessagePage, SendAck } from '../src/chat/chat.types';
import { MessageRateLimiter } from '../src/chat/message-rate-limiter';
import type { PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestPrisma, createUser, resetDatabase } from './helpers/test-db';

process.env.JWT_ACCESS_SECRET ??= 'e2e-secret-only-for-tests';

type Role = 'USER' | 'ADMIN';
interface Client {
  socket: Socket;
  received: ChatMessage[];
}

const jwt = new JwtService();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const secret = () => process.env.JWT_ACCESS_SECRET as string;

let app: INestApplication;
let prisma: PrismaClient;
let baseUrl: string;
const sockets: Socket[] = [];

beforeAll(async () => {
  prisma = await createTestPrisma();
  const moduleRef = await Test.createTestingModule({
    imports: [ChatModule, AuthModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    // Hạn mức lớn: user id lặp lại giữa các test (RESTART IDENTITY), bộ đếm thì không reset
    .overrideProvider(MessageRateLimiter)
    .useValue(new MessageRateLimiter(1000, 10_000))
    .compile();

  app = moduleRef.createNestApplication({ logger: ['error'] });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

afterEach(() => {
  for (const s of sockets.splice(0)) s.close();
});

beforeEach(async () => {
  await resetDatabase(prisma);
});

// ---------- helpers ----------
async function makeUser(tag: string, role: Role = 'USER', isActive = true) {
  const user = await createUser(prisma, tag);
  if (role === 'USER' && isActive) return user;
  return prisma.user.update({
    where: { id: user.id },
    data: { role, isActive },
  });
}

function sign(
  sub: number,
  role: Role,
  opts: { secret?: string; expired?: boolean } = {},
) {
  const key = opts.secret ?? secret();
  if (opts.expired) {
    const exp = Math.floor(Date.now() / 1000) - 10;
    return jwt.signAsync({ sub, role, exp }, { secret: key });
  }
  return jwt.signAsync({ sub, role }, { secret: key, expiresIn: '15m' });
}

async function connect(token?: string): Promise<Client> {
  const socket = io(baseUrl, {
    path: CHAT_PATH,
    transports: ['websocket'],
    auth: token === undefined ? {} : { token },
    forceNew: true,
    reconnection: false,
  });
  sockets.push(socket);
  const received: ChatMessage[] = [];
  socket.on('message:new', (m: ChatMessage) => received.push(m));
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', (err) => reject(err));
  });
  return { socket, received };
}

const send = (c: Client, payload: unknown) =>
  c.socket
    .timeout(5000)
    .emitWithAck('message:send', payload) as Promise<SendAck>;

async function waitUntil(cond: () => boolean, ms = 3000) {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('waitUntil: quá thời gian chờ');
    await sleep(20);
  }
}

async function connectUser(tag: string, role: Role = 'USER') {
  const user = await makeUser(tag, role);
  const token = await sign(user.id, role);
  return { user, token, client: await connect(token) };
}

// ---------- tests ----------
describe('chat (PostgreSQL + socket thật)', () => {
  it('(g) 10 tin đầu tiên gửi song song chỉ tạo một hội thoại', async () => {
    const { client } = await connectUser('a');
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        send(client, { content: `tin ${i}` }),
      ),
    );
    const failures = results.flatMap((r, i) =>
      r.status === 'fulfilled' && r.value.ok ? [] : [{ i, r }],
    );
    expect(failures).toEqual([]);
    expect(await prisma.conversation.count()).toBe(1);
    expect(await prisma.message.count()).toBe(10);
  });

  it('(h) khách gửi, admin nhận; admin trả lời, khách nhận', async () => {
    const a = await connectUser('a');
    const admin = await connectUser('admin', 'ADMIN');

    const ack1 = await send(a.client, { content: '  Xin chào  ' });
    expect(ack1.ok).toBe(true);
    await waitUntil(() => admin.client.received.length === 1);
    expect(admin.client.received[0]).toMatchObject({
      customerId: a.user.id,
      senderId: a.user.id,
      fromAdmin: false,
      content: 'Xin chào', // đã cắt khoảng trắng
    });

    const ack2 = await send(admin.client, {
      content: 'Shop nghe đây',
      customerId: a.user.id,
    });
    expect(ack2.ok).toBe(true);
    await waitUntil(() => a.client.received.length === 2); // 1 bản echo + 1 trả lời
    expect(a.client.received[1]).toMatchObject({
      customerId: a.user.id,
      senderId: admin.user.id,
      fromAdmin: true,
      content: 'Shop nghe đây',
    });

    expect(admin.client.received).toHaveLength(2); // không nhận trùng
    const rows = await prisma.message.findMany({ orderBy: { id: 'asc' } });
    expect(rows.map((r) => r.content)).toEqual(['Xin chào', 'Shop nghe đây']);
  });

  it('(i) cô lập: khách A không nhận tin của B (socket) và không đọc được (REST)', async () => {
    const a = await connectUser('a');
    const b = await connectUser('b');
    const admin = await connectUser('admin', 'ADMIN');

    await send(a.client, { content: 'bí mật của A' });
    await waitUntil(() => admin.client.received.length === 1);
    await sleep(300);
    expect(b.client.received).toEqual([]);

    await send(b.client, { content: 'tin của B' });
    await waitUntil(() => admin.client.received.length === 2);
    await sleep(300);
    expect(a.client.received.map((m) => m.content)).toEqual(['bí mật của A']);
    expect(b.client.received.map((m) => m.content)).toEqual(['tin của B']);

    const res = await request(app.getHttpServer())
      .get('/api/chat/messages')
      .set('Authorization', `Bearer ${b.token}`)
      .expect(200);
    const page = res.body as MessagePage;
    expect(page.items.map((m) => m.content)).toEqual(['tin của B']);
  });

  describe('(j) handshake bị từ chối', () => {
    const cases: [string, () => Promise<string | undefined>][] = [
      ['không token', async () => undefined],
      ['token rác', async () => 'khong-phai-jwt'],
      [
        'sai chữ ký',
        async () => {
          const u = await makeUser('x');
          return sign(u.id, u.role, { secret: 'secret-khac' });
        },
      ],
      [
        'hết hạn',
        async () => {
          const u = await makeUser('x');
          return sign(u.id, u.role, { expired: true });
        },
      ],
      [
        'tài khoản bị khóa',
        async () => {
          const u = await makeUser('x', 'USER', false);
          return sign(u.id, u.role);
        },
      ],
      ['user không tồn tại', async () => sign(999_999, 'USER')],
    ];

    it.each(cases)('%s', async (_name, getToken) => {
      const token = await getToken();
      await expect(connect(token)).rejects.toThrow('UNAUTHORIZED');
    });
  });

  it('(k) A gửi kèm customerId của B: tin vẫn vào hội thoại của A', async () => {
    const a = await connectUser('a');
    const b = await connectUser('b');
    const admin = await connectUser('admin', 'ADMIN');

    const ack = await send(a.client, {
      content: 'giả mạo',
      customerId: b.user.id,
    });
    expect(ack.ok).toBe(true);
    if (!ack.ok) return;
    expect(ack.message.customerId).toBe(a.user.id);

    await waitUntil(() => admin.client.received.length === 1);
    await sleep(300);
    expect(b.client.received).toEqual([]);
    expect(
      await prisma.conversation.findUnique({ where: { userId: b.user.id } }),
    ).toBeNull();
    const own = await prisma.conversation.findUniqueOrThrow({
      where: { userId: a.user.id },
      include: { messages: true },
    });
    expect(own.messages.map((m) => m.content)).toEqual(['giả mạo']);
  });

  it('(l) route admin: user thường 403, không token 401', async () => {
    const a = await makeUser('a');
    const server = app.getHttpServer();
    await request(server)
      .get('/api/admin/chat/conversations')
      .set('Authorization', `Bearer ${await sign(a.id, a.role)}`)
      .expect(403);
    await request(server).get('/api/admin/chat/conversations').expect(401);
  });
});
