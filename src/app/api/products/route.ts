import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
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

const SORT_MAP: Record<string, Prisma.ProductOrderByWithRelationInput> = {
  CREATED_DESC: { createdAt: "desc" },
  CREATED_ASC: { createdAt: "asc" },
  PRICE_DESC: { priceCents: "desc" },
  PRICE_ASC: { priceCents: "asc" },
};

const SUPPORTS_SHOT_FIELD =
  "shot" in Prisma.ProductScalarFieldEnum &&
  typeof Prisma.ProductScalarFieldEnum.shot === "string";

if (!SUPPORTS_SHOT_FIELD) {
  console.warn(
    "Prisma client missing Product.shot field - run `npm install` or `npx prisma generate` to refresh the client."
  );
}

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
    const shots = csv(url.searchParams.get("shots"));
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
    if (shots.length && SUPPORTS_SHOT_FIELD) AND.push({ shot: { in: shots } });
    if (statuses.length) {
      const allowed = statuses.filter(isProductStatus);
      if (allowed.length) {
        AND.push({ status: { in: allowed } });
      }
    }

    const where: Prisma.ProductWhereInput = AND.length ? { AND } : {};

    const orderBy = SORT_MAP[sortKey] ?? SORT_MAP.CREATED_DESC;

    const [
      items,
      total,
      brandRows,
      sizeRows,
      conditionRows,
      shotRows,
      statusRows,
    ] = await Promise.all([
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
        select: { brand: true },
      }),
      prisma.product.findMany({
        where,
        select: { size: true },
      }),
      prisma.product.findMany({
        where,
        select: { condition: true },
      }),
      SUPPORTS_SHOT_FIELD
        ? prisma.product.findMany({
            where,
            select: { shot: true },
          })
        : Promise.resolve([] as { shot: string | null }[]),
      prisma.product.findMany({
        where,
        select: { status: true },
      }),
    ]);

    const toSortedUnique = (values: (string | null | undefined)[]) => {
      const unique = new Set<string>();
      for (const value of values) {
        if (typeof value === "string" && value.length) {
          unique.add(value);
        }
      }
      return Array.from(unique).sort((a, b) => a.localeCompare(b));
    };

    const facets = {
      brands: toSortedUnique(brandRows.map((r) => r.brand)),
      sizes: toSortedUnique(sizeRows.map((r) => r.size)),
      conditions: toSortedUnique(conditionRows.map((r) => r.condition)),
      shots: SUPPORTS_SHOT_FIELD
        ? toSortedUnique(shotRows.map((r) => r.shot))
        : [],
      statuses: toSortedUnique(
        statusRows.map((r) => (isProductStatus(r.status) ? r.status : null))
      ),
    };

    const lastPage = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json(
      {
        total,
        page,
        lastPage,
        limit,
        items,
        facets,
        supportsShot: SUPPORTS_SHOT_FIELD,
        status: 200,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
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
      shot: string | null;
      priceCents: number;
      status: ProductStatus;
      notes: string | null;
      sku: string | null;
      dimensionA: string | null;
      dimensionB: string | null;
      dimensionC: string | null;
    }>;

    const created = await prisma.product.create({
      data: {
        title: body.title ?? "Nowy produkt",
        brand: body.brand ?? "",
        size: body.size ?? "",
        condition: body.condition ?? "",
        ...(SUPPORTS_SHOT_FIELD ? { shot: body.shot ?? null } : {}),
        priceCents: body.priceCents ?? 0,
        status: ensureProductStatus(body.status, DEFAULT_PRODUCT_STATUS),
        notes: body.notes ?? null,
        sku: body.sku ?? null,
        dimensionA: body.dimensionA ?? null,
        dimensionB: body.dimensionB ?? null,
        dimensionC: body.dimensionC ?? null,
      },
      include: {
        photos: true,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Validation error";
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
