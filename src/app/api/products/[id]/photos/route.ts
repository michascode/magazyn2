import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

type TParams = { id: string };
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

export async function POST(req: Request, ctx: { params: Promise<TParams> }) {
  const { id: productId } = await ctx.params;

  const fd = await req.formData();
  const files = fd.getAll('photos').filter((f): f is File => f instanceof File);

  if (!files.length) return NextResponse.json({ error: 'No files' }, { status: 400 });

  await mkdir(UPLOAD_DIR, { recursive: true });

  const writes = files.map(async (file, i) => {
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name || '').toLowerCase() || '.jpg';
    const fileName = `${productId}-${Date.now()}-${i}${ext}`;
    const rel = path.join('uploads', fileName);
    const abs = path.join(process.cwd(), rel);
    await writeFile(abs, buf);
    return prisma.photo.create({
      data: {
        productId,
        url: `/${rel.replace(/\\/g,'/')}`,
        order: i,
        isFront: false,
        sizeBytes: buf.length,
      }
    });
  });

  await Promise.all(writes);

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { photos: { orderBy: [{ isFront:'desc' }, { order:'asc' }, { createdAt:'asc' }] } }
  });

  return NextResponse.json(product, { status: 200 });
}
