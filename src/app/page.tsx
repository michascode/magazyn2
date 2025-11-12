// src/app/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ProductStatus = 'NA_MAGAZYNIE' | 'ZAREZERWOWANY' | 'SPRZEDANY'; // dopasuj do Twojego enumu jeśli różni się
type Photo = { id: string; url: string; isFront: boolean; order: number; createdAt: string };
type Product = {
  id: string;
  title: string;
  brand: string | null;
  size: string | null;
  condition: string | null;
  status: ProductStatus;
  priceCents: number;
  sku: string | null;
  notes: string | null;
  createdAt: string;
  photos: Photo[];
};

type Facets = {
  brands?: string[];
  sizes?: string[];
  conditions?: string[];
  statuses?: ProductStatus[];
};

export default function Page() {
  const [items, setItems] = useState<Product[]>([]);
  const [facets, setFacets] = useState<Facets>({});
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  // filtry
  const [query, setQuery] = useState('');
  const [brands, setBrands] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [condition, setCondition] = useState<string | null>(null);
  const [status, setStatus] = useState<ProductStatus | ''>('');
  const [sortKey, setSortKey] = useState('CREATED_DESC');
  const [limit, setLimit] = useState(12);

  const loadingRef = useRef(false);

  const buildParams = useCallback(
    (targetPage: number, withFacets: boolean) => {
      const p = new URLSearchParams();
      p.set('page', String(targetPage));
      p.set('limit', String(limit));
      p.set('sort', sortKey);
      if (query.trim()) p.set('query', query.trim());
      brands.forEach((b) => p.append('brands', b));
      sizes.forEach((s) => p.append('sizes', s));
      if (condition) p.set('condition', condition);
      if (status) p.set('status', status);
      p.set('facets', withFacets ? '1' : '0');
      return p;
    },
    [brands, sizes, condition, status, query, limit, sortKey]
  );

  const loadProducts = useCallback(
    async (mode: 'reset' | 'append' = 'reset') => {
      if (loadingRef.current) return;
      loadingRef.current = true;

      const targetPage = mode === 'reset' ? 1 : page + 1;
      const params = buildParams(targetPage, mode === 'reset');

      const res = await fetch(`/api/products?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        loadingRef.current = false;
        throw new Error(await res.text());
      }
      const data = await res.json();

      setTotal(data.total ?? 0);
      setLastPage(data.lastPage ?? 1);

      if (mode === 'reset') {
        setItems(data.items ?? []);
        setPage(1);
        setFacets(data.facets ?? {});
      } else {
        setItems((prev) => [...prev, ...(data.items ?? [])]);
        setPage((prev) => prev + 1);
      }

      loadingRef.current = false;
    },
    [page, buildParams]
  );

  // pierwsze ładowanie (facets=1)
  useEffect(() => {
    // reset przy starcie
    loadProducts('reset');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // helper do zaznaczania filtra
  function toggle<T extends string>(arr: T[], value: T): T[] {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  }

  // apply filtrów – pełny reset (facets=1, nowy zestaw)
  const applyFilters = useCallback(() => loadProducts('reset'), [loadProducts]);

  return (
    <main className="mx-auto max-w-6xl p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Magazyn produktów</h1>

      {/* FILTRY */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj: tytuł / marka / SKU / notatki"
          className="border rounded px-3 py-2"
        />

        <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="border rounded px-3 py-2">
          <option value="CREATED_DESC">Najnowsze</option>
          <option value="CREATED_ASC">Najstarsze</option>
          <option value="PRICE_DESC">Cena ⬆</option>
          <option value="PRICE_ASC">Cena ⬇</option>
        </select>

        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="border rounded px-3 py-2">
          <option value={8}>8</option>
          <option value={12}>12</option>
          <option value={24}>24</option>
        </select>

        <button
          onClick={applyFilters}
          className="bg-black text-white rounded px-3 py-2 disabled:opacity-50"
          disabled={loadingRef.current}
        >
          Zastosuj filtry
        </button>
      </section>

      {/* quick-filters */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <div className="text-sm mb-1">Marki</div>
          <div className="flex flex-wrap gap-2">
            {(facets.brands ?? []).map((b) => (
              <button
                key={b}
                onClick={() => setBrands((arr) => toggle(arr, b))}
                className={`px-2 py-1 rounded border ${
                  brands.includes(b) ? 'bg-black text-white' : 'bg-white'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm mb-1">Rozmiary</div>
          <div className="flex flex-wrap gap-2">
            {(facets.sizes ?? []).map((s) => (
              <button
                key={s}
                onClick={() => setSizes((arr) => toggle(arr, s))}
                className={`px-2 py-1 rounded border ${
                  sizes.includes(s) ? 'bg-black text-white' : 'bg-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select
            value={condition ?? ''}
            onChange={(e) => setCondition(e.target.value || null)}
            className="border rounded px-3 py-2"
          >
            <option value="">Stan — dowolny</option>
            {(facets.conditions ?? []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus((e.target.value || '') as any)}
            className="border rounded px-3 py-2"
          >
            <option value="">Status — dowolny</option>
            {(facets.statuses ?? []).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* LISTA */}
      <section className="space-y-3">
        <div className="text-sm text-gray-600">
          Razem: {total} • Strona {page}/{lastPage}
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((p) => {
            const img = p.photos.find((ph) => ph.isFront) ?? p.photos[0];
            return (
              <li key={p.id} className="border rounded-xl overflow-hidden">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.url} alt={p.title} className="w-full h-48 object-cover" />
                ) : (
                  <div className="w-full h-48 bg-gray-100 flex items-center justify-center">brak zdjęcia</div>
                )}
                <div className="p-3 space-y-1">
                  <div className="font-medium line-clamp-2">{p.title}</div>
                  <div className="text-sm text-gray-600">
                    {p.brand ?? '-'} • {p.size ?? '-'} • {p.condition ?? '-'}
                  </div>
                  <div className="text-sm">
                    {Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format((p.priceCents ?? 0) / 100)}
                  </div>
                  <div className="text-xs text-gray-500">{p.status}</div>
                </div>
              </li>
            );
          })}
        </ul>

        {page < lastPage && (
          <div className="flex justify-center">
            <button
              onClick={() => loadProducts('append')}
              className="px-4 py-2 border rounded"
              disabled={loadingRef.current}
            >
              Załaduj więcej
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
