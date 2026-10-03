import type { Prisma } from '../generated/prisma/client';

export const productInclude = {
  category: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
  images: {
    select: { id: true, url: true, sortOrder: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;
