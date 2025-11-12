import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type TParams = { id: string };

export async function GET(_req: Request, ctx: { params: Promise<TParams> }) {
  const { id } = await ctx.params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { photos: { orderBy: [{ isFront:'desc' }, { order:'asc' }, { createdAt:'asc' }] } }
  });
  if (!product) return NextResponse.json({ error:'Not found' }, { status:404 });
  return NextResponse.json(product, { status:200 });
}

export async function PATCH(req: Request, ctx: { params: Promise<TParams> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(()=>({})) as any;
  const data:any = {
    title: body.title ?? undefined,
    brand: body.brand ?? undefined,
    size: body.size ?? undefined,
    condition: body.condition ?? undefined,
    status: body.status ?? undefined,
    notes: body.notes ?? undefined,
    priceCents: body.priceCents ?? undefined,
    sku: body.sku ?? undefined,
  };
  const updated = await prisma.product.update({
    where: { id }, data,
    include: { photos: { orderBy: [{ isFront:'desc' }, { order:'asc' }, { createdAt:'asc' }] } }
  });
  return NextResponse.json(updated, { status:200 });
}

export async function DELETE(_req: Request, ctx: { params: Promise<TParams> }) {
  const { id } = await ctx.params;
  await prisma.product.delete({ where: { id } }); // Photos cascade
  return NextResponse.json({ ok:true }, { status:200 });
}
