import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type SortKey = 'CREATED_DESC'|'CREATED_ASC'|'PRICE_DESC'|'PRICE_ASC';
const SORT_MAP: Record<SortKey, any> = {
  CREATED_DESC: { createdAt: 'desc' },
  CREATED_ASC : { createdAt: 'asc'  },
  PRICE_DESC  : { priceCents: 'desc' },
  PRICE_ASC   : { priceCents: 'asc'  },
};

function toArray(v?: string|null){ return v ? v.split(',').map(s=>s.trim()).filter(Boolean) : []; }

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get('query')?.trim() || '';
  const brands = toArray(url.searchParams.get('brands'));
  const sizes = toArray(url.searchParams.get('sizes'));
  const conditions = toArray(url.searchParams.get('conditions'));
  const statuses = toArray(url.searchParams.get('statuses'));
  const page = Math.max(1, Number(url.searchParams.get('page')||1));
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')||12)));
  const sortKey = (url.searchParams.get('sort') as SortKey) || 'CREATED_DESC';

  const AND:any[] = [];
  if (query) AND.push({ title: { contains: query, mode: 'insensitive' }});
  if (brands.length) AND.push({ brand: { in: brands }});
  if (sizes.length) AND.push({ size: { in: sizes }});
  if (conditions.length) AND.push({ condition: { in: conditions }});
  if (statuses.length) AND.push({ status: { in: statuses }});

  const where = AND.length ? { AND } : {};
  const orderBy = SORT_MAP[sortKey] ?? SORT_MAP.CREATED_DESC;

  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where, orderBy, skip: (page-1)*limit, take: limit,
      include: { photos: { orderBy: [{ isFront: 'desc' }, { order: 'asc' }, { createdAt: 'asc' }] } }
    })
  ]);

  const [brandRows, sizeRows, conditionRows, statusRows] = await Promise.all([
    prisma.product.findMany({ distinct:['brand'], select:{ brand:true }, orderBy:{ brand:'asc' }}),
    prisma.product.findMany({ distinct:['size'], select:{ size:true }, orderBy:{ size:'asc' }}),
    prisma.product.findMany({ distinct:['condition'], select:{ condition:true }, orderBy:{ condition:'asc' }}),
    prisma.product.findMany({ distinct:['status'], select:{ status:true }, orderBy:{ status:'asc' }}),
  ]);

  return NextResponse.json({
    total, page, limit, lastPage: Math.max(1, Math.ceil(total/limit)),
    items,
    facets: {
      brands: brandRows.map(r=>r.brand!).filter(Boolean),
      sizes: sizeRows.map(r=>r.size!).filter(Boolean),
      conditions: conditionRows.map(r=>r.condition!).filter(Boolean),
      statuses: statusRows.map(r=>r.status!).filter(Boolean),
    }
  }, { status: 200 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(()=>({})) as any;
    const created = await prisma.product.create({
      data: {
        title: body.title ?? 'Nowy produkt',
        status: body.status ?? 'NA_MAGAZYNIE',
        priceCents: body.priceCents ?? 0,
        brand: body.brand ?? null,
        size: body.size ?? null,
        condition: body.condition ?? null,
        notes: body.notes ?? null,
        sku: body.sku ?? null,
      },
      include: { photos: { orderBy: [{ isFront:'desc' }, { order:'asc' }, { createdAt:'asc' }] } }
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e:any) {
    console.error(e);
    return NextResponse.json({ error: 'Create failed' }, { status: 400 });
  }
}
