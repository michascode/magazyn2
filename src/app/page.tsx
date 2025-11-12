// src/app/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProductCard from '@/components/ProductCard';

type UiPhoto = { id: string; url: string; isFront?: boolean | null; order?: number | null; createdAt?: string | null; };
type UIProduct = { id: string; title: string; brand: string | null; size: string | null; condition: string | null; status: string; priceCents: number; photos: UiPhoto[]; };
type Facets = { brands: string[]; sizes: string[]; conditions: string[]; statuses: string[]; };
type ApiRes = { total: number; page: number; lastPage: number; limit: number; items: UIProduct[]; facets: Facets; };

const getUrl = () => (typeof window !== 'undefined' ? new URL(window.location.href) : new URL('http://localhost'));
const buildApiUrl = (q: { query: string; sort: string; statusCsv: string; brandsCsv: string; sizesCsv: string; conditionsCsv: string; page: number; limit: number; }) => {
  const u = typeof window !== 'undefined' ? new URL('/api/products', window.location.origin) : new URL('http://localhost/api/products');
  if (q.query) u.searchParams.set('query', q.query);
  if (q.sort) u.searchParams.set('sort', q.sort);
  u.searchParams.set('status', q.statusCsv);
  u.searchParams.set('brands', q.brandsCsv);
  u.searchParams.set('sizes', q.sizesCsv);
  u.searchParams.set('conditions', q.conditionsCsv);
  u.searchParams.set('page', String(q.page));
  u.searchParams.set('limit', String(q.limit));
  return u;
};

export default function Page() {
  const router = useRouter();

  const initial = useMemo(() => {
    const u = getUrl();
    return {
      query: u.searchParams.get('query') ?? '',
      sort: u.searchParams.get('sort') ?? 'CREATED_DESC',
      statusCsv: u.searchParams.get('status') ?? '',
      brandsCsv: u.searchParams.get('brands') ?? '',
      sizesCsv: u.searchParams.get('sizes') ?? '',
      conditionsCsv: u.searchParams.get('conditions') ?? '',
      page: Math.max(1, Number(u.searchParams.get('page') ?? '1')),
      limit: Math.min(100, Math.max(1, Number(u.searchParams.get('limit') ?? '12'))),
    };
  }, []);

  const [query, setQuery] = useState(initial.query);
  const [sort, setSort] = useState(initial.sort);
  const [statusCsv, setStatusCsv] = useState(initial.statusCsv);
  const [brandsCsv, setBrandsCsv] = useState(initial.brandsCsv);
  const [sizesCsv, setSizesCsv] = useState(initial.sizesCsv);
  const [conditionsCsv, setConditionsCsv] = useState(initial.conditionsCsv);
  const [page, setPage] = useState(initial.page);
  const [limit, setLimit] = useState(initial.limit);

  const [items, setItems] = useState<UIProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [facets, setFacets] = useState<Facets>({ brands: [], sizes: [], conditions: [], statuses: [] });

  const loadingRef = useRef(false);

  const pushUrl = useCallback(() => {
    if (typeof window === 'undefined') return;
    const url = getUrl();
    const sp = url.searchParams;
    query ? sp.set('query', query) : sp.delete('query');
    sp.set('sort', sort);
    sp.set('status', statusCsv);
    sp.set('brands', brandsCsv);
    sp.set('sizes', sizesCsv);
    sp.set('conditions', conditionsCsv);
    sp.set('page', String(page));
    sp.set('limit', String(limit));
    window.history.pushState({}, '', url);
  }, [query, sort, statusCsv, brandsCsv, sizesCsv, conditionsCsv, page, limit]);

  const fetchProducts = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const apiUrl = buildApiUrl({ query, sort, statusCsv, brandsCsv, sizesCsv, conditionsCsv, page, limit });
      const res = await fetch(apiUrl.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as ApiRes;
      setItems(data.items);
      setTotal(data.total);
      setLastPage(data.lastPage);
      setFacets(data.facets);
    } finally {
      loadingRef.current = false;
    }
  }, [query, sort, statusCsv, brandsCsv, sizesCsv, conditionsCsv, page, limit]);

  useEffect(() => {
    pushUrl();
    fetchProducts();
  }, [pushUrl, fetchProducts]);

  const resetAndFetch = (updater: () => void) => {
    updater();
    setPage(1);
  };

  async function createProduct() {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      alert(await res.text());
      return;
    }
    const p = (await res.json()) as { id: string };
    router.push(`/products/${p.id}`);
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Magazyn</h1>
        <button className="ml-auto rounded bg-black text-white px-4 py-2" onClick={createProduct}>
          Dodaj produkt
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center mb-6">
        <input
          className="border px-3 py-2 rounded w-64"
          placeholder="Szukaj…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && resetAndFetch(() => {})}
        />

        <select
          className="border px-2 py-2 rounded"
          value={sort}
          onChange={(e) => resetAndFetch(() => setSort(e.target.value))}
          title="Sortowanie"
        >
          <option value="CREATED_DESC">Najnowsze</option>
          <option value="CREATED_ASC">Najstarsze</option>
          <option value="PRICE_DESC">Cena ↓</option>
          <option value="PRICE_ASC">Cena ↑</option>
        </select>

        <input
          className="border px-3 py-2 rounded w-56"
          placeholder="Statusy (CSV)"
          value={statusCsv}
          onChange={(e) => setStatusCsv(e.target.value)}
          onBlur={() => resetAndFetch(() => {})}
          list="facet-status"
        />
        <datalist id="facet-status">{facets.statuses.map((s) => <option key={s} value={s} />)}</datalist>

        <input
          className="border px-3 py-2 rounded w-48"
          placeholder="Marki (CSV)"
          value={brandsCsv}
          onChange={(e) => setBrandsCsv(e.target.value)}
          onBlur={() => resetAndFetch(() => {})}
          list="facet-brands"
        />
        <datalist id="facet-brands">{facets.brands.map((b) => <option key={b} value={b} />)}</datalist>

        <input
          className="border px-3 py-2 rounded w-40"
          placeholder="Rozmiary (CSV)"
          value={sizesCsv}
          onChange={(e) => setSizesCsv(e.target.value)}
          onBlur={() => resetAndFetch(() => {})}
          list="facet-sizes"
        />
        <datalist id="facet-sizes">{facets.sizes.map((b) => <option key={b} value={b} />)}</datalist>

        <input
          className="border px-3 py-2 rounded w-56"
          placeholder="Stany (CSV)"
          value={conditionsCsv}
          onChange={(e) => setConditionsCsv(e.target.value)}
          onBlur={() => resetAndFetch(() => {})}
          list="facet-conditions"
        />
        <datalist id="facet-conditions">{facets.conditions.map((c) => <option key={c} value={c} />)}</datalist>

        <button className="rounded bg-black text-white px-4 py-2" onClick={() => resetAndFetch(() => {})}>
          Filtruj
        </button>
      </div>

      <div className="text-sm text-gray-600 mb-3">
        {total} wyników • strona {page}/{lastPage} • limit {limit}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>

      <div className="flex items-center justify-center gap-3 mt-8">
        <button
          className="border px-3 py-2 rounded disabled:opacity-50"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          ← Poprzednia
        </button>
        <span className="text-sm text-gray-700">
          strona {page} / {Math.max(1, lastPage)}
        </span>
        <button
          className="border px-3 py-2 rounded disabled:opacity-50"
          disabled={page >= lastPage}
          onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
        >
          Następna →
        </button>
      </div>
    </div>
  );
}
