/* eslint-disable @next/next/no-img-element */
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/format';
import {
  DEFAULT_PRODUCT_STATUS,
  PRODUCT_STATUSES,
  ensureProductStatus,
  optionalProductStatus,
} from '@/lib/product-status';

type UiPhoto = {
  id: string;
  url: string;
  isFront?: boolean | null;
  order?: number | null;
  createdAt?: string | Date | null;
};

type UIProduct = {
  id: string;
  title: string;
  brand: string | null;
  size: string | null;
  condition: string | null;
  status: string;
  priceCents: number;
  photos: UiPhoto[];
};

type Facets = {
  brands: string[];
  sizes: string[];
  conditions: string[];
  statuses: string[];
};

type ApiRes = {
  total: number;
  page: number;
  lastPage: number;
  limit: number;
  items: UIProduct[];
  facets: Facets;
};

type DetailedProduct = {
  id: string;
  title: string;
  brand: string | null;
  size: string | null;
  condition: string | null;
  status: string;
  priceCents: number;
  notes: string | null;
  photos: UiPhoto[];
};

const getUrl = () =>
  typeof window !== 'undefined'
    ? new URL(window.location.href)
    : new URL('http://localhost');

const buildApiUrl = (q: {
  query: string;
  sort: string;
  statusCsv: string;
  brandsCsv: string;
  sizesCsv: string;
  conditionsCsv: string;
  page: number;
  limit: number;
}) => {
  const u =
    typeof window !== 'undefined'
      ? new URL('/api/products', window.location.origin)
      : new URL('http://localhost/api/products');
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

function pickFrontPhoto(photos: UiPhoto[]): string | null {
  if (!photos?.length) return null;
  const first = photos.find((p) => p.isFront);
  if (first) return first.url;
  const sorted = [...photos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return sorted[0]?.url ?? null;
}

const parsePriceInput = (value: string): number => {
  const normalized = value.replace(',', '.');
  const num = Number(normalized);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.round(num * 100));
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
  const limit = initial.limit;

  const [items, setItems] = useState<UIProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [facets, setFacets] = useState<Facets>({
    brands: [],
    sizes: [],
    conditions: [],
    statuses: [],
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<DetailedProduct | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);

  const [titleInput, setTitleInput] = useState('');
  const [brandInput, setBrandInput] = useState('');
  const [sizeInput, setSizeInput] = useState('');
  const [conditionInput, setConditionInput] = useState('');
  const [statusInput, setStatusInput] = useState(PRODUCT_STATUSES[0]);
  const [priceInput, setPriceInput] = useState('0');
  const [notesInput, setNotesInput] = useState('');

  const loadingRef = useRef(false);

  const pushUrl = useCallback(() => {
    if (typeof window === 'undefined') return;
    const url = getUrl();
    const sp = url.searchParams;
    if (query) {
      sp.set('query', query);
    } else {
      sp.delete('query');
    }
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
      const apiUrl = buildApiUrl({
        query,
        sort,
        statusCsv,
        brandsCsv,
        sizesCsv,
        conditionsCsv,
        page,
        limit,
      });
      const res = await fetch(apiUrl.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as ApiRes;
      setItems(data.items);
      setTotal(data.total);
      setLastPage(data.lastPage);
      setFacets(data.facets);
      setSelectedId((prev) => {
        if (prev && data.items.some((item) => item.id === prev)) {
          return prev;
        }
        return data.items[0]?.id ?? null;
      });
      if (!data.items.length) {
        setSelected(null);
      }
    } finally {
      loadingRef.current = false;
    }
  }, [query, sort, statusCsv, brandsCsv, sizesCsv, conditionsCsv, page, limit]);

  useEffect(() => {
    pushUrl();
    fetchProducts();
  }, [pushUrl, fetchProducts]);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);

    fetch(`/api/products/${selectedId}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return (await res.json()) as DetailedProduct;
      })
      .then((data) => {
        if (cancelled) return;
        setSelected(data);
        setTitleInput(data.title ?? '');
        setBrandInput(data.brand ?? '');
        setSizeInput(data.size ?? '');
        setConditionInput(data.condition ?? '');
        setStatusInput(ensureProductStatus(data.status));
        setPriceInput(String((data.priceCents ?? 0) / 100));
        setNotesInput(data.notes ?? '');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Błąd podczas pobierania produktu';
        setDetailError(message);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const resetAndFetch = (updater?: () => void) => {
    updater?.();
    setPage(1);
  };

  const clearFilters = () => {
    setQuery('');
    setSort('CREATED_DESC');
    setStatusCsv('');
    setBrandsCsv('');
    setSizesCsv('');
    setConditionsCsv('');
    setPage(1);
  };

  async function createProduct() {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: DEFAULT_PRODUCT_STATUS }),
    });
    if (!res.ok) {
      alert(await res.text());
      return;
    }
    const p = (await res.json()) as { id: string };
    router.push(`/products/${p.id}`);
  }

  const frontPhoto = useMemo(
    () => pickFrontPhoto(selected?.photos ?? []),
    [selected]
  );

  async function saveSelected() {
    if (!selectedId) return;
    setSaveBusy(true);
    try {
      const payload = {
        title: titleInput,
        brand: brandInput || null,
        size: sizeInput || null,
        condition: conditionInput || null,
        status: statusInput,
        priceCents: parsePriceInput(priceInput),
        notes: notesInput || null,
      };
      const res = await fetch(`/api/products/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as DetailedProduct;
      setSelected(data);
      setStatusInput(ensureProductStatus(data.status));
      setPriceInput(String((data.priceCents ?? 0) / 100));
      setItems((prev) =>
        prev.map((item) =>
          item.id === data.id
            ? {
                ...item,
                title: data.title,
                brand: data.brand,
                size: data.size,
                condition: data.condition,
                status: data.status,
                priceCents: data.priceCents,
                photos: data.photos,
              }
            : item
        )
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Błąd zapisu';
      alert(message);
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Magazyn</h1>
          <div className="ml-auto flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <span>
              {total} wyników • strona {page}/{Math.max(1, lastPage)}
            </span>
          </div>
          <button
            className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90"
            onClick={createProduct}
          >
            Dodaj produkt
          </button>
        </header>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-lg font-semibold">Filtry</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              className="w-full max-w-xs rounded border border-gray-300 px-3 py-2"
              placeholder="Szukaj…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') resetAndFetch();
              }}
            />

      <select
              className="rounded border border-gray-300 px-3 py-2"
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
              className="w-full max-w-xs rounded border border-gray-300 px-3 py-2"
              placeholder="Statusy (CSV)"
              value={statusCsv}
              onChange={(e) => setStatusCsv(e.target.value)}
              onBlur={() => resetAndFetch()}
              list="facet-status"
            />
            <datalist id="facet-status">
              {facets.statuses.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>

            <input
              className="w-full max-w-xs rounded border border-gray-300 px-3 py-2"
              placeholder="Marki (CSV)"
              value={brandsCsv}
              onChange={(e) => setBrandsCsv(e.target.value)}
              onBlur={() => resetAndFetch()}
              list="facet-brands"
            />
            <datalist id="facet-brands">
              {facets.brands.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>

            <input
              className="w-full max-w-[10rem] rounded border border-gray-300 px-3 py-2"
              placeholder="Rozmiary (CSV)"
              value={sizesCsv}
              onChange={(e) => setSizesCsv(e.target.value)}
              onBlur={() => resetAndFetch()}
              list="facet-sizes"
            />
            <datalist id="facet-sizes">
              {facets.sizes.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>

            <input
              className="w-full max-w-xs rounded border border-gray-300 px-3 py-2"
              placeholder="Stany (CSV)"
              value={conditionsCsv}
              onChange={(e) => setConditionsCsv(e.target.value)}
              onBlur={() => resetAndFetch()}
              list="facet-conditions"
            />
            <datalist id="facet-conditions">
              {facets.conditions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>

            <div className="ml-auto flex items-center gap-2">
              <button
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                onClick={() => resetAndFetch()}
              >
                Filtruj
              </button>
              <button
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                onClick={clearFilters}
              >
                Wyczyść
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(260px,320px)_1fr]">
          <aside className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Produkty</h2>
              <span className="text-xs uppercase tracking-wide text-gray-500">
                Lista
              </span>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
                {items.map((p) => {
                  const isSelected = selectedId === p.id;
                  const thumb = pickFrontPhoto(p.photos);
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className={`flex w-full items-center gap-3 px-3 py-3 text-left transition ${
                        isSelected
                          ? 'bg-black/5 shadow-inner'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="h-16 w-14 flex-shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-100">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={p.title || 'Produkt'}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
                            brak
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="line-clamp-1 text-sm font-medium text-gray-900">
                            {p.title || 'Bez nazwy'}
                          </span>
                          <span className="text-sm font-semibold text-gray-900">
                            {formatPrice(p.priceCents)}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {[p.brand, p.size, p.condition]
                            .filter(Boolean)
                            .join(' • ') || '—'}
                        </div>
                        <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
                          {p.status}
                        </div>
                      </div>
                    </button>
                  );
                })}
                {!items.length && (
                  <div className="p-6 text-center text-sm text-gray-500">
                    Brak wyników dla wybranych filtrów.
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <button
                className="rounded border border-gray-300 px-3 py-2 disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Poprzednia
              </button>
              <span className="text-gray-600">
                Strona {page} / {Math.max(1, lastPage)}
              </span>
              <button
                className="rounded border border-gray-300 px-3 py-2 disabled:opacity-50"
                disabled={page >= lastPage}
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              >
                Następna →
              </button>
            </div>
          </aside>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edycja produktu</h2>
              {selectedId && (
                <Link
                  href={`/products/${selectedId}`}
                  className="text-sm font-medium text-gray-600 underline-offset-4 hover:underline"
                >
                  Otwórz pełny widok
                </Link>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              {!selectedId && (
                <div className="p-6 text-sm text-gray-500">
                  Wybierz produkt z listy po lewej stronie, aby rozpocząć edycję.
                </div>
              )}

              {selectedId && detailLoading && (
                <div className="p-6 text-sm text-gray-500">Ładowanie danych produktu…</div>
              )}

              {selectedId && detailError && !detailLoading && (
                <div className="p-6 text-sm text-red-600">{detailError}</div>
              )}

              {selectedId && selected && !detailLoading && !detailError && (
                <div className="grid gap-6 lg:grid-cols-[minmax(260px,320px)_1fr]">
                  <div className="space-y-3">
                    <div className="aspect-[4/5] overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                      {frontPhoto ? (
                        <img
                          src={frontPhoto}
                          alt={selected.title || 'Zdjęcie produktu'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-gray-500">
                          Brak zdjęcia głównego
                        </div>
                      )}
                    </div>
                    {!!selected.photos.length && (
                      <div className="grid grid-cols-4 gap-2">
                        {selected.photos.map((photo) => (
                          <div
                            key={photo.id}
                            className={`overflow-hidden rounded border ${
                              photo.isFront ? 'border-black' : 'border-gray-200'
                            }`}
                          >
                            <img
                              src={photo.url}
                              alt="Miniatura"
                              className="h-20 w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveSelected();
                    }}
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block text-sm">
                        <span className="text-gray-600">Nazwa</span>
                        <input
                          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                          value={titleInput}
                          onChange={(e) => setTitleInput(e.target.value)}
                          required
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="text-gray-600">Marka</span>
                        <input
                          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                          value={brandInput}
                          onChange={(e) => setBrandInput(e.target.value)}
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="text-gray-600">Rozmiar</span>
                        <input
                          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                          value={sizeInput}
                          onChange={(e) => setSizeInput(e.target.value)}
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="text-gray-600">Stan</span>
                        <input
                          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                          value={conditionInput}
                          onChange={(e) => setConditionInput(e.target.value)}
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="text-gray-600">Status</span>
                        <select
                          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                          value={statusInput}
                          onChange={(e) =>
                            setStatusInput(
                              optionalProductStatus(e.target.value) ?? DEFAULT_PRODUCT_STATUS
                            )
                          }
                        >
                          {PRODUCT_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm">
                        <span className="text-gray-600">Cena</span>
                        <input
                          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                          value={priceInput}
                          onChange={(e) => setPriceInput(e.target.value)}
                        />
                      </label>
                    </div>

                    <label className="block text-sm">
                      <span className="text-gray-600">Notatki</span>
                      <textarea
                        className="mt-1 h-32 w-full rounded border border-gray-300 px-3 py-2"
                        value={notesInput}
                        onChange={(e) => setNotesInput(e.target.value)}
                      />
                    </label>

      <div className="flex flex-wrap gap-3">
                      <button
                        type="submit"
                        className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-50"
                        disabled={saveBusy}
                      >
                        Zapisz zmiany
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
