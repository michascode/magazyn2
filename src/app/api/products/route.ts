// src/app/api/products/route.ts
import { NextResponse } from 'next/server';
import { ProductStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/* ---------- sort mapping ---------- */
const SORT_MAP: Record<
  string,
  Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[]
> = {
  CREATED_DESC: { createdAt: 'desc' },
  CREATED_ASC: { createdAt: 'asc' },
  PRICE_DESC: { priceCents: 'desc' },
  PRICE_ASC: { priceCents: 'asc' },
};

function parseCsv(v?: string | null): string[] {
  if (!v) return [];
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function mergeParams(url: URL, key: string): string[] {
  // wspiera zarówno ?key=a&key=b jak i ?key=a,b
  const repeated = url.searchParams.getAll(key);
  const csv = parseCsv(url.searchParams.get(key));
  return Array.from(new Set([...repeated, ...csv]));
}

function safeStatus(v?: string | null): ProductStatus | undefined {
  if (!v) return undefined;
  const list = Object.values(ProductStatus) as string[];
  return list.includes(v) ? (v as ProductStatus) : undefined;
}

/* ---------- GET /api/products ---------- */
export async function GET(req: Request) {
  const url = new URL(req.url);

  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') ?? 12)));
  const sortKey = url.searchParams.get('sort') ?? 'CREATED_DESC';
  const wantFacets = url.searchParams.get('facets') === '1';

  const query = (url.searchParams.get('query') ?? '').trim();

  const brands = mergeParams(url, 'brands');
  const sizes = mergeParams(url, 'sizes');
  const condition = url.searchParams.get('condition') ?? undefined;
  const status = safeStatus(url.searchParams.get('status'));

  const AND: Prisma.ProductWhereInput[] = [];

  if (query) {
    AND.push({
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { brand: { contains: query, mode: 'insensitive' } },
        { sku: { contains: query, mode: 'insensitive' } },
        { notes: { contains: query, mode: 'insensitive' } },
      ],
    });
  }
  if (brands.length) AND.push({ brand: { in: brands } });
  if (sizes.length) AND.push({ size: { in: sizes } });
  if (condition) AND.push({ condition });
  if (status) AND.push({ status });

  const where: Prisma.ProductWhereInput = AND.length ? { AND } : {};
  const orderBy = SORT_MAP[sortKey] ?? SORT_MAP.CREATED_DESC;

  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        photos: {
          orderBy: [{ isFront: 'desc' }, { order: 'asc' }, { createdAt: 'asc' }],
        },
      },
    }),
  ]);

  let facets:
    | {
        brands?: string[];
        sizes?: string[];
        conditions?: string[];
        statuses?: ProductStatus[];
      }
    | undefined;

  if (wantFacets) {
    const [brandRows, sizeRows, conditionRows, statusRows] = await Promise.all([
      prisma.product.findMany({
        distinct: ['brand'],
        where: { brand: { not: null } },
        select: { brand: true },
        orderBy: { brand: 'asc' },
      }),
      prisma.product.findMany({
        distinct: ['size'],
        where: { size: { not: null } },
        select: { size: true },
        orderBy: { size: 'asc' },
      }),
      prisma.product.findMany({
        distinct: ['condition'],
        where: { condition: { not: null } },
        select: { condition: true },
        orderBy: { condition: 'asc' },
      }),
      prisma.product.findMany({
        distinct: ['status'],
        select: { status: true },
        orderBy: { status: 'asc' },
      }),
    ]);

    facets = {
      brands: brandRows.map((r) => r.brand!).filter(Boolean),
      sizes: sizeRows.map((r) => r.size!).filter(Boolean),
      conditions: conditionRows.map((r) => r.condition!).filter(Boolean),
      statuses: Array.from(new Set(statusRows.map((r) => r.status))) as ProductStatus[],
    };
  }

  const lastPage = Math.max(1, Math.ceil(total / limit));
  return NextResponse.json({ total, page, limit, lastPage, items, facets }, { status: 200 });
}

/* ---------- (opcjonalnie) POST /api/products — zostawiamy minimalny create ---------- */
// Jeśli nie korzystasz teraz — możesz usunąć.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const created = await prisma.product.create({
      data: {
        title: body.title ?? 'Nowy produkt',
        brand: body.brand ?? null,
        size: body.size ?? null,
        condition: body.condition ?? null,
        status: safeStatus(body.status) ?? ProductStatus.NA_MAGAZYNIE,
        priceCents: Number(body.priceCents ?? 0),
        notes: body.notes ?? null,
      },
      include: {
        photos: {
          orderBy: [{ isFront: 'desc' }, { order: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Create failed' }, { status: 400 });
  }
}
