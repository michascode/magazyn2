// src/app/api/products/[id]/photos/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

/** POST /api/products/:id/photos – upload pojedynczego pliku (pole `file`) */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Brak pliku' }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase();
  const filename = `${crypto.randomUUID()}.${ext}`;

  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), bytes);

  const url = `/uploads/${filename}`;

  const photo = await prisma.photo.create({
    data: { productId: id, url, isFront: false, order: 0 },
  });

  return NextResponse.json(photo, { status: 201 });
}
