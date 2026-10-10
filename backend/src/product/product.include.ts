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

export const productListSelect = {
  id: true,
  name: true,
  price: true,
  stock: true,
  isActive: true,
  category: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
  images: {
    select: { url: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    take: 1,
  },
} satisfies Prisma.ProductSelect;

export type ProductListRow = Prisma.ProductGetPayload<{
  select: typeof productListSelect;
}>;

export const productCartSelect = {
  id: true,
  name: true,
  price: true,
  stock: true,
  isActive: true,
  images: {
    select: { url: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    take: 1,
  },
} satisfies Prisma.ProductSelect;
