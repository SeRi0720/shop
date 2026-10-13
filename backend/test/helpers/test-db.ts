import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';

config({ quiet: true });

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** Từ chối chạy nếu URL không phải database test cục bộ. */
export function getTestDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL_TEST;
  if (!raw) throw new Error('Thiếu DATABASE_URL_TEST trong backend/.env');
  if (raw === process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL_TEST trùng DATABASE_URL (database dev)');
  }
  const url = new URL(raw);
  const dbName = decodeURIComponent(url.pathname.slice(1));
  if (!dbName.toLowerCase().includes('test')) {
    throw new Error(`Tên database "${dbName}" không chứa "test", từ chối chạy`);
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(
      `Host "${url.hostname}" không phải máy cục bộ, từ chối chạy`,
    );
  }
  return raw;
}

export async function createTestPrisma(): Promise<PrismaClient> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: getTestDatabaseUrl() }),
  });
  await prisma.$connect();
  // Kiểm tra lần hai bằng tên database MÀ KẾT NỐI THẬT ĐANG DÙNG
  const [row] = await prisma.$queryRaw<{ db: string }[]>`
    SELECT current_database() AS db`;
  if (!row.db.toLowerCase().includes('test')) {
    await prisma.$disconnect();
    throw new Error(`Đang kết nối "${row.db}", không phải database test`);
  }
  return prisma;
}

/** Chỉ gọi sau createTestPrisma (đã qua chốt chặn). CASCADE xóa mọi bảng phụ thuộc. */
export async function resetDatabase(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE users, products, categories, brands RESTART IDENTITY CASCADE',
  );
}

let seq = 0;

export async function createProduct(
  prisma: PrismaClient,
  opts: { stock: number; price?: number },
) {
  const n = ++seq;
  const category = await prisma.category.create({ data: { name: `cat-${n}` } });
  const brand = await prisma.brand.create({ data: { name: `brand-${n}` } });
  return prisma.product.create({
    data: {
      name: `Sản phẩm test ${n}`,
      price: opts.price ?? 1_000_000,
      stock: opts.stock,
      categoryId: category.id,
      brandId: brand.id,
    },
  });
}

export function createUser(prisma: PrismaClient, tag: string) {
  return prisma.user.create({
    data: {
      email: `${tag}-${++seq}@test.local`,
      passwordHash: 'not-a-real-hash',
      fullName: `User ${tag}`,
    },
  });
}

export function fillCart(
  prisma: PrismaClient,
  userId: number,
  lines: { productId: number; quantity: number }[],
) {
  return prisma.cart.create({
    data: { userId, items: { create: lines } },
  });
}
