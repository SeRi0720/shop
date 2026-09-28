import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { hashPassword } from '../src/auth/password.util';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_FULL_NAME?.trim() || 'Admin';

  if (!email || !password) {
    throw new Error('Thiếu ADMIN_EMAIL hoặc ADMIN_PASSWORD trong .env');
  }
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD phải có ít nhất 8 ký tự');
  }

  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: 'ADMIN', isActive: true },
    create: {
      email,
      passwordHash: await hashPassword(password),
      fullName,
      role: 'ADMIN',
    },
  });

  console.log(`Seed xong: admin ${admin.email} (id ${admin.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
