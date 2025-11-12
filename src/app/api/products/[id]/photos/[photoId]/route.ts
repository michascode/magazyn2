import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type TParams = { id: string; photoId: string };

export async function PATCH(req: Request, ctx: { params: Promise<TParams> }) {
  const { id: productId, photoId } = await ctx.params;
  const body = await req.json().catch(()=>({})) as any;

  if (body.isFront === true) {
    await prisma.photo.updateMany({ where:{ productId }, data:{ isFront:false }});
  }

  await prisma.photo.update({
    where: { id: photoId },
    data: {
      isFront: body.isFront ?? undefined,
      order: body.order ?? undefined,
      role: body.role ?? undefined,
    }
  });

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { photos: { orderBy: [{ isFront:'desc' }, { order:'asc' }, { createdAt:'asc' }] } }
  });

  return NextResponse.json(product, { status: 200 });
}

export async function DELETE(_req: Request, ctx: { params: Promise<TParams> }) {
  const { id: productId, photoId } = await ctx.params;
  await prisma.photo.delete({ where: { id: photoId }});
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { photos: { orderBy: [{ isFront:'desc' }, { order:'asc' }, { createdAt:'asc' }] } }
  });
  return NextResponse.json(product, { status: 200 });
}
