// src/app/api/products/[id]/photos/[photoId]/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import path from 'path';
import fs from 'fs/promises';

/** PATCH -> ustaw isFront */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; photoId: string }> }
) {
  const { id, photoId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { isFront?: boolean };

  if (body.isFront) {
    await prisma.$transaction([
      prisma.photo.updateMany({ where: { productId: id }, data: { isFront: false } }),
      prisma.photo.update({ where: { id: photoId }, data: { isFront: true } }),
    ]);
  }

  const photo = await prisma.photo.findUnique({ where: { id: photoId } });
  return NextResponse.json(photo, { status: 200 });
}

/** DELETE -> usuń zdjęcie (i plik z dysku jeśli to /uploads/...) */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; photoId: string }> }
) {
  const { photoId } = await ctx.params;

  const photo = await prisma.photo.delete({ where: { id: photoId } }).catch(() => null);

  if (photo?.url?.startsWith('/uploads/')) {
    const diskPath = path.join(process.cwd(), 'public', photo.url.replace(/^\//, ''));
    try {
      await fs.unlink(diskPath);
    } catch {
      /* ignore */
    }
  }

  return new NextResponse(null, { status: 204 });
}
