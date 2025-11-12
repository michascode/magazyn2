// src/app/api/products/[id]/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const STATUS_SET = new Set([
  'NA_MAGAZYNIE',
  'WYSTAWIONE',
  'ZAREZERWOWANE',
  'SPRZEDANE',
  'ARCHIWUM',
]);
const safeStatus = (v: string | null) => (v && STATUS_SET.has(v) ? v : undefined);

/** GET /api/products/:id */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      photos: {
        orderBy: [{ isFront: 'desc' }, { order: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(product, { status: 200 });
}

/** PATCH /api/products/:id */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({} as any));

  const data: any = {
    title: body.title ?? undefined,
    brand: body.brand ?? undefined,
    size: body.size ?? undefined,
    condition: body.condition ?? undefined,
    priceCents:
      typeof body.priceCents === 'number'
        ? Math.max(0, Math.floor(body.priceCents))
        : undefined,
    status: safeStatus(body.status ?? null),
    notes: body.notes ?? undefined,
  };

  const updated = await prisma.product.update({
    where: { id },
    data,
    include: {
      photos: {
        orderBy: [{ isFront: 'desc' }, { order: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  return NextResponse.json(updated, { status: 200 });
}

/** DELETE /api/products/:id */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  await prisma.photo.deleteMany({ where: { productId: id } });
  await prisma.product.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
