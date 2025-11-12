import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TParams = { id: string };

function safeStatus(v?: string | null): Prisma.ProductStatus | undefined {
  if (!v) return undefined;
  const list = Object.values(Prisma.ProductStatus) as string[];
  return list.includes(v) ? (v as Prisma.ProductStatus) : undefined;
}

export async function GET(_req: Request, ctx: { params: Promise<TParams> }) {
  const { id } = await ctx.params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      photos: { orderBy: [{ isFront: "desc" }, { order: "asc" }, { createdAt: "asc" }] },
    },
  });

  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(product, { status: 200 });
}

export async function PATCH(req: Request, ctx: { params: Promise<TParams> }) {
  const { id } = await ctx.params;

  try {
    const body = await req.json().catch(() => ({} as any));

    const data: Prisma.ProductUpdateInput = {
      title: body.title ?? undefined,
      brand: body.brand ?? undefined,
      size: body.size ?? undefined,
      condition: body.condition ?? undefined,
      notes: body.notes ?? undefined,
      priceCents:
        typeof body.priceCents === "number" ? body.priceCents : (undefined as unknown as number),
      status: safeStatus(body.status) ?? undefined,
      sku: body.sku ?? undefined,
    };

    const updated = await prisma.product.update({
      where: { id },
      data,
      include: {
        photos: { orderBy: [{ isFront: "desc" }, { order: "asc" }, { createdAt: "asc" }] },
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Update failed" }, { status: 400 });
  }
}
