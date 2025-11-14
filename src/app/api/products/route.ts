import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  DEFAULT_PRODUCT_STATUS,
  ensureProductStatus,
  isProductStatus,
  type ProductStatus,
} from "@/lib/product-status";

/* -------- helpers -------- */

function csv(v: string | null): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const SORT_MAP: Record<
  string,
  Prisma.ProductOrderByWithRelationInput
> = {
  CREATED_DESC: { createdAt: "desc" },
  CREATED_ASC: { createdAt: "asc" },
  PRICE_DESC: { priceCents: "desc" },
  PRICE_ASC: { priceCents: "asc" },
};

/* -------- GET /api/products -------- */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const query = url.searchParams.get("query")?.trim() ?? "";
    const sortKey = url.searchParams.get("sort") ?? "CREATED_DESC";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const limit = Math.max(1, Number(url.searchParams.get("limit") ?? "12"));

    const brands = csv(url.searchParams.get("brands"));
    const sizes = csv(url.searchParams.get("sizes"));
    const conditions = csv(url.searchParams.get("conditions"));
    const statuses = csv(url.searchParams.get("status"));

    const AND: Prisma.ProductWhereInput[] = [];

    if (query) {
      AND.push({
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { brand: { contains: query, mode: "insensitive" } },
          { notes: { contains: query, mode: "insensitive" } },
          { sku: { contains: query, mode: "insensitive" } },
        ],
      });
    }

    if (brands.length) AND.push({ brand: { in: brands } });
    if (sizes.length) AND.push({ size: { in: sizes } });
    if (conditions.length) AND.push({ condition: { in: conditions } });
    if (statuses.length) {
      const allowed = statuses.filter(isProductStatus);
      if (allowed.length) {
        AND.push({ status: { in: allowed } });
      }
    }

    const where: Prisma.ProductWhereInput = AND.length ? { AND } : {};

    const orderBy = SORT_MAP[sortKey] ?? SORT_MAP.CREATED_DESC;

    const [items, total, brandRows, sizeRows, conditionRows, statusRows] =
      await Promise.all([
        prisma.product.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            photos: {
              orderBy: [
                { isFront: "desc" },
                { order: "asc" },
                { createdAt: "asc" },
              ],
              select: {
                id: true,
                url: true,
                isFront: true,
                order: true,
                createdAt: true,
              },
            },
          },
        }),
        prisma.product.count({ where }),
        prisma.product.findMany({
          where,
          distinct: ["brand"],
          select: { brand: true },
          orderBy: { brand: "asc" },
        }),
        prisma.product.findMany({
          where,
          distinct: ["size"],
          select: { size: true },
          orderBy: { size: "asc" },
        }),
        prisma.product.findMany({
          where,
          distinct: ["condition"],
          select: { condition: true },
          orderBy: { condition: "asc" },
        }),
        prisma.product.findMany({
          where,
          distinct: ["status"],
          select: { status: true },
          orderBy: { status: "asc" },
        }),
      ]);

    const facets = {
      brands: brandRows.map((r) => r.brand!).filter(Boolean),
      sizes: sizeRows.map((r) => r.size!).filter(Boolean),
      conditions: conditionRows.map((r) => r.condition!).filter(Boolean),
      statuses: Array.from(new Set(statusRows.map((r) => r.status))),
    };

    const lastPage = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json(
      { total, page, lastPage, limit, items, facets, status: 200 },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json(
      { error: message, status: 500 },
      { status: 500 }
    );
  }
}

/* -------- POST /api/products --------
   Szybkie utworzenie „pustego” produktu (np. przycisk „Dodaj”)
-------------------------------------*/
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<{
      title: string;
      brand: string;
      size: string;
      condition: string;
      priceCents: number;
      status: ProductStatus;
      notes: string | null;
      sku: string | null;
    }>;

    const created = await prisma.product.create({
      data: {
        title: body.title ?? "Nowy produkt",
        brand: body.brand ?? "",
        size: body.size ?? "",
        condition: body.condition ?? "",
        priceCents: body.priceCents ?? 0,
        status: ensureProductStatus(body.status, DEFAULT_PRODUCT_STATUS),
        notes: body.notes ?? null,
        sku: body.sku ?? null,
      },
      include: {
        photos: true,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Validation error';
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
