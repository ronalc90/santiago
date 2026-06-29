import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireApiUser } from '@/lib/auth/api';
import { prisma } from '@/lib/db';
import { DEFAULT_PAGE_SIZE as PAGE_SIZE } from '@/lib/config/constants';

export const runtime = 'nodejs';

/** Lista el catálogo Dropi importado, con búsqueda, filtro por categoría, orden y paginación. */
export async function GET(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const search = url.searchParams.get('search')?.trim() ?? '';
  const category = url.searchParams.get('category')?.trim() ?? '';
  const sort = url.searchParams.get('sort') === 'cost' ? 'cost' : 'name';
  const dir = url.searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);

  const where: Prisma.DropiCatalogItemWhereInput = {};
  if (search) where.name = { contains: search, mode: 'insensitive' };
  if (category) where.category = category;

  // `cost` puede ser null: con orden por costo, los null van al final.
  const orderBy: Prisma.DropiCatalogItemOrderByWithRelationInput =
    sort === 'cost' ? { cost: { sort: dir, nulls: 'last' } } : { name: dir };

  const [items, total, totalCatalog, categoryGroups] = await Promise.all([
    prisma.dropiCatalogItem.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, name: true, sku: true, category: true, cost: true, stock: true, imageUrl: true },
    }),
    prisma.dropiCatalogItem.count({ where }),
    prisma.dropiCatalogItem.count(),
    prisma.dropiCatalogItem.groupBy({ by: ['category'], where: { category: { not: null } }, _count: true, orderBy: { category: 'asc' } }),
  ]);

  const categories = categoryGroups.map((g) => g.category).filter((c): c is string => Boolean(c));
  return NextResponse.json({ items, total, totalCatalog, categories, page, pageSize: PAGE_SIZE });
}
