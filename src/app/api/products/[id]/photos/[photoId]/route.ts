import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import path from "node:path";
import fs from "node:fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TParams = { id: string; photoId: string };

export async function PATCH(req: Request, ctx: { params: Promise<TParams> }) {
  const { id, photoId } = await ctx.params;

  try {
    const body = await req.json().catch(() => ({}));

    // ustawianie zdjęcia frontowego (exclusive)
    if (typeof body.isFront === "boolean" && body.isFront) {
      await prisma.photo.updateMany({ where: { productId: id }, data: { isFront: false } });
      await prisma.photo.update({ where: { id: photoId }, data: { isFront: true } });
    } else {
      await prisma.photo.update({
        where: { id: photoId },
        data: {
          isFront: typeof body.isFront === "boolean" ? body.isFront : undefined,
          order: typeof body.order === "number" ? body.order : undefined,
          role: body.role ?? undefined,
        },
      });
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: { photos: { orderBy: [{ isFront: "desc" }, { order: "asc" }, { createdAt: "asc" }] } },
    });

    return NextResponse.json(product, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Photo update failed" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<TParams> }) {
  const { id, photoId } = await ctx.params;

  try {
    const photo = await prisma.photo.findUnique({ where: { id: photoId } });
    if (!photo) return NextResponse.json({ ok: true }, { status: 200 });

    // Spróbuj usunąć plik lokalny (jeśli trzymasz na dysku)
    if (photo.url?.startsWith("/")) {
      const abs = path.join(process.cwd(), photo.url);
      fs.unlink(abs).catch(() => void 0);
    }

    await prisma.photo.delete({ where: { id: photoId } });

    const product = await prisma.product.findUnique({
      where: { id },
      include: { photos: { orderBy: [{ isFront: "desc" }, { order: "asc" }, { createdAt: "asc" }] } },
    });

    return NextResponse.json(product, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Delete failed" }, { status: 400 });
  }
}
