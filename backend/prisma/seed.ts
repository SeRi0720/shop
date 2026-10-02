import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { hashPassword } from '../src/auth/password.util';
import { brands, categories, products } from './seed-data';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function seedCatalog() {
  const categoryIds = new Map<string, number>();
  for (const name of categories) {
    const c = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categoryIds.set(name, c.id);
  }
  const brandIds = new Map<string, number>();
  for (const name of brands) {
    const b = await prisma.brand.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    brandIds.set(name, b.id);
  }
  let created = 0;
  for (const { category, brand, ...data } of products) {
    const exists = await prisma.product.findFirst({
      where: { name: data.name },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.product.create({
      data: {
        ...data,
        categoryId: categoryIds.get(category)!,
        brandId: brandIds.get(brand)!,
      },
    });
    created++;
  }
  console.log(
    `Seed catalog: ${created} sản phẩm mới (tổng ${products.length} trong file)`,
  );
}

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
  await seedCatalog();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
