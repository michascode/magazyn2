// src/app/api/products/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma, ProductStatus } from "@prisma/client";

/* ---------- sort mapping ---------- */
const SORT_MAP: Record<
  string,
  Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[]
> = {
  CREATED_DESC: { createdAt: "desc" },
  CREATED_ASC: { createdAt: "asc" },
  PRICE_DESC: { priceCents: "desc" },
  PRICE_ASC: { priceCents: "asc" },
};

/* ---------- helpers ---------- */
function parseCsv(v?: string | null): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function safeStatus(v?: string | null): ProductStatus | undefined {
  const all = Object.values(ProductStatus) as string[];
  return all.includes(v ?? "") ? (v as ProductStatus) : undefined;
}

/* ---------- GET /api/products ---------- */
export async function GET(req: Request) {
  const url = new URL(req.url);

  const query = url.searchParams.get("query")?.trim() || "";
  const brands = parseCsv(url.searchParams.get("brands"));
  const sizes = parseCsv(url.searchParams.get("sizes"));
  const conditions = parseCsv(url.searchParams.get("conditions"));
  const statuses = parseCsv(url.searchParams.get("statuses"));

  const sortKey = url.searchParams.get("sort") || "CREATED_DESC";
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 12)));

  const AND: Prisma.ProductWhereInput[] = [];

  if (query) {
    AND.push({
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { brand: { contains: query, mode: "insensitive" } },
        { size: { contains: query, mode: "insensitive" } },
        { notes: { contains: query, mode: "insensitive" } },
      ],
    });
  }
  if (brands.length) AND.push({ brand: { in: brands } });
  if (sizes.length) AND.push({ size: { in: sizes } });
  if (conditions.length) AND.push({ condition: { in: conditions } });
  if (statuses.length) AND.push({ status: { in: statuses as ProductStatus[] } });

  const where: Prisma.ProductWhereInput = AND.length ? { AND } : {};
  const orderBy = SORT_MAP[sortKey] ?? SORT_MAP.CREATED_DESC;

  // 2 zapytania: total + items
  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        photos: {
          orderBy: [{ isFront: "desc" }, { order: "asc" }, { createdAt: "asc" }],
        },
      },
    }),
  ]);

  // 4 lekkie zapytania facetów (distinct + index)
  const [brandRows, sizeRows, conditionRows, statusRows] = await Promise.all([
    prisma.product.findMany({
      distinct: ["brand"],
      where: { brand: { not: null } },
      select: { brand: true },
      orderBy: { brand: "asc" },
    }),
    prisma.product.findMany({
      distinct: ["size"],
      where: { size: { not: null } },
      select: { size: true },
      orderBy: { size: "asc" },
    }),
    prisma.product.findMany({
      distinct: ["condition"],
      select: { condition: true },
      orderBy: { condition: "asc" },
    }),
    prisma.product.findMany({
      distinct: ["status"],
      select: { status: true },
      orderBy: { status: "asc" },
    }),
  ]);

  const facets = {
    brands: brandRows.map((r) => r.brand!).filter(Boolean),
    sizes: sizeRows.map((r) => r.size!).filter(Boolean),
    conditions: conditionRows.map((r) => r.condition!).filter(Boolean),
    statuses: Array.from(new Set(statusRows.map((r) => r.status))) as ProductStatus[],
  };

  const lastPage = Math.max(1, Math.ceil(total / limit));

  return NextResponse.json(
    { total, page, limit, lastPage, items, facets },
    { status: 200 }
  );
}

/* ---------- POST /api/products ---------- */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<{
      title: string;
      status: string;
      priceCents: number;
      brand: string | null;
      size: string | null;
      condition: string | null;
      notes: string | null;
      sku: string | null;
    }>;

    const created = await prisma.product.create({
      data: {
        title: body.title ?? "Nowy produkt",
        status: safeStatus(body.status) ?? ProductStatus.NA_MAGAZYNIE,
        priceCents: body.priceCents ?? 0,
        brand: body.brand ?? null,
        size: body.size ?? null,
        condition: body.condition ?? null,
        notes: body.notes ?? null,
        sku: body.sku ?? null,
      },
      include: {
        photos: {
          orderBy: [{ isFront: "desc" }, { order: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Create failed" }, { status: 400 });
  }
}
