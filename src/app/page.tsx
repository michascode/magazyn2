/* eslint-disable @next/next/no-img-element */
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  shot: string | null;
  status: string;
  priceCents: number;
  photos: UiPhoto[];
};

type Facets = {
  brands: string[];
  sizes: string[];
  conditions: string[];
  shots: string[];
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
  shot: string | null;
  status: string;
  priceCents: number;
  notes: string | null;
  photos: UiPhoto[];
  dimensionA: string | null;
  dimensionB: string | null;
  dimensionC: string | null;
};

const toUiProduct = (data: DetailedProduct): UIProduct => ({
  id: data.id,
  title: data.title,
  brand: data.brand,
  size: data.size,
  condition: data.condition,
  shot: data.shot,
  status: data.status,
  priceCents: data.priceCents,
  photos: data.photos,
});

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
  shotsCsv: string;
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
  u.searchParams.set('shots', q.shotsCsv);
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

  const initial = useMemo(() => {
    const u = getUrl();
    return {
      query: u.searchParams.get('query') ?? '',
      sort: u.searchParams.get('sort') ?? 'CREATED_DESC',
      statusCsv: u.searchParams.get('status') ?? '',
      brandsCsv: u.searchParams.get('brands') ?? '',
      sizesCsv: u.searchParams.get('sizes') ?? '',
      conditionsCsv: u.searchParams.get('conditions') ?? '',
      shotsCsv: u.searchParams.get('shots') ?? '',
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
  const [shotsCsv, setShotsCsv] = useState(initial.shotsCsv);
  const [page, setPage] = useState(initial.page);
  const limit = initial.limit;

  const [items, setItems] = useState<UIProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [facets, setFacets] = useState<Facets>({
    brands: [],
    sizes: [],
    conditions: [],
    shots: [],
    statuses: [],
  });
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<DetailedProduct | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<UiPhoto | null>(null);

  const [titleInput, setTitleInput] = useState('');
  const [brandInput, setBrandInput] = useState('');
  const [sizeInput, setSizeInput] = useState('');
  const [conditionInput, setConditionInput] = useState('');
  const [shotInput, setShotInput] = useState('');
  const [statusInput, setStatusInput] = useState(PRODUCT_STATUSES[0]);
  const [priceInput, setPriceInput] = useState('0');
  const [notesInput, setNotesInput] = useState('');
  const [dimensionAInput, setDimensionAInput] = useState('');
  const [dimensionBInput, setDimensionBInput] = useState('');
  const [dimensionCInput, setDimensionCInput] = useState('');

  const loadingRef = useRef(false);
  const selectedIdRef = useRef<string | null>(null);

  const applySelectedData = useCallback(
    (data: DetailedProduct) => {
      setSelected(data);
      setTitleInput(data.title ?? '');
      setBrandInput(data.brand ?? '');
      setSizeInput(data.size ?? '');
      setConditionInput(data.condition ?? '');
      setShotInput(data.shot ?? '');
      setStatusInput(ensureProductStatus(data.status));
      setPriceInput(String((data.priceCents ?? 0) / 100));
      setNotesInput(data.notes ?? '');
      setDimensionAInput(data.dimensionA ?? '');
      setDimensionBInput(data.dimensionB ?? '');
      setDimensionCInput(data.dimensionC ?? '');
      setPreviewPhoto(null);
      setItems((prev) => {
        const nextItem = toUiProduct(data);
        return prev.some((item) => item.id === data.id)
          ? prev.map((item) => (item.id === data.id ? nextItem : item))
          : [nextItem, ...prev];
      });
    },
    []
  );

  const fetchProductDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/products/${id}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as DetailedProduct;
  }, []);

  const refreshSelected = useCallback(
    async (id?: string, options?: { showLoader?: boolean }) => {
      const targetId = id ?? selectedIdRef.current;
      if (!targetId) return;
      const showLoader = options?.showLoader ?? true;
      if (showLoader) {
        setDetailLoading(true);
        setDetailError(null);
      }
      try {
        const data = await fetchProductDetail(targetId);
        if (selectedIdRef.current !== targetId) return;
        applySelectedData(data);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Błąd podczas pobierania produktu';
        setDetailError(message);
      } finally {
        if (showLoader && selectedIdRef.current === targetId) {
          setDetailLoading(false);
        }
      }
    },
    [fetchProductDetail, applySelectedData]
  );

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
    sp.set('shots', shotsCsv);
    sp.set('page', String(page));
    sp.set('limit', String(limit));
    window.history.pushState({}, '', url);
  }, [query, sort, statusCsv, brandsCsv, sizesCsv, conditionsCsv, shotsCsv, page, limit]);
  
  const fetchProducts = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setListError(null);
    try {
      const apiUrl = buildApiUrl({
        query,
        sort,
        statusCsv,
        brandsCsv,
        sizesCsv,
        conditionsCsv,
        shotsCsv,
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
      setSelectedId((prev) => prev ?? data.items[0]?.id ?? null);
      if (!data.items.length) {
        setSelected(null);
        setPreviewPhoto(null);
      }
    } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Błąd podczas pobierania listy produktów';
      setListError(message);
      setItems([]);
    } finally {
      loadingRef.current = false;
    }
  }, [query, sort, statusCsv, brandsCsv, sizesCsv, conditionsCsv, shotsCsv, page, limit]);

  useEffect(() => {
    pushUrl();
    fetchProducts();
  }, [pushUrl, fetchProducts]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    if (!selectedId) {
      setSelected(null);
      setPreviewPhoto(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

      void refreshSelected(selectedId);
  }, [selectedId, refreshSelected]);

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
    setShotsCsv('');
    setPage(1);
  };

  async function createProduct() {
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: DEFAULT_PRODUCT_STATUS }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = (await res.json()) as DetailedProduct;
      setSelectedId(created.id);
      selectedIdRef.current = created.id;
      applySelectedData(created);
      await fetchProducts();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Nie udało się utworzyć produktu';
      alert(message);
    }
  }

  const frontPhotoData = useMemo(() => {
    if (!selected?.photos?.length) return null;
    const front = selected.photos.find((photo) => photo.isFront);
    if (front) return front;
    const sorted = [...selected.photos].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0)
    );
    return sorted[0] ?? null;
  }, [selected]);

  const frontPhoto = frontPhotoData?.url ?? null;

  async function saveSelected() {
    if (!selectedId) return;
    setSaveBusy(true);
    try {
      const payload = {
        title: titleInput,
        brand: brandInput || null,
        size: sizeInput || null,
        condition: conditionInput || null,
        shot: shotInput || null,
        status: statusInput,
        priceCents: parsePriceInput(priceInput),
        notes: notesInput || null,
        dimensionA: dimensionAInput || null,
        dimensionB: dimensionBInput || null,
        dimensionC: dimensionCInput || null,
      };
      const res = await fetch(`/api/products/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as DetailedProduct;
      applySelectedData(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Błąd zapisu';
      alert(message);
    } finally {
      setSaveBusy(false);
    }
  }

  async function deleteSelected() {
    if (!selectedId) return;
    if (!confirm('Usunąć ten produkt?')) return;
    setSaveBusy(true);
    try {
      const res = await fetch(`/api/products/${selectedId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      setItems((prev) => prev.filter((item) => item.id !== selectedId));
      setSelectedId(null);
      selectedIdRef.current = null;
      setSelected(null);
      setPreviewPhoto(null);
      await fetchProducts();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Błąd usuwania produktu';
      alert(message);
    } finally {
      setSaveBusy(false);
    }
  }

  async function uploadPhotos(files: FileList | null) {
    const targetId = selectedIdRef.current;
    if (!targetId || !files?.length) return;
    setPhotoBusy(true);
    try {
      await Promise.all(
        Array.from(files).map(async (file) => {
          const fd = new FormData();
          fd.append('file', file);
          const res = await fetch(`/api/products/${targetId}/photos`, {
            method: 'POST',
            body: fd,
          });
          if (!res.ok) throw new Error(await res.text());
        })
      );
      await refreshSelected(targetId, { showLoader: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Błąd podczas dodawania zdjęć';
      alert(message);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function setPhotoAsFront(photoId: string) {
    const targetId = selectedIdRef.current;
    if (!targetId) return;
    setPhotoBusy(true);
    try {
      const res = await fetch(`/api/products/${targetId}/photos/${photoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFront: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      await refreshSelected(targetId, { showLoader: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Nie udało się ustawić zdjęcia głównego';
      alert(message);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function deletePhoto(photoId: string) {
    const targetId = selectedIdRef.current;
    if (!targetId) return;
    if (!confirm('Usunąć to zdjęcie?')) return;
    setPhotoBusy(true);
    try {
      const res = await fetch(`/api/products/${targetId}/photos/${photoId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await res.text());
      await refreshSelected(targetId, { showLoader: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Błąd podczas usuwania zdjęcia';
      alert(message);
    } finally {
      setPhotoBusy(false);
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

      <select
              className="min-w-[12rem] rounded border border-gray-300 px-3 py-2"
              value={statusCsv}
              onChange={(e) =>
                resetAndFetch(() => setStatusCsv(e.target.value))
              }
              title="Status"
            >
              <option value="">Wszystkie statusy</option>
              {facets.statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              className="min-w-[12rem] rounded border border-gray-300 px-3 py-2"
              value={brandsCsv}
              onChange={(e) =>
                resetAndFetch(() => setBrandsCsv(e.target.value))
              }
              title="Marka"
            >
              <option value="">Wszystkie marki</option>
              {facets.brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <select
              className="min-w-[10rem] rounded border border-gray-300 px-3 py-2"
              value={sizesCsv}
              onChange={(e) =>
                resetAndFetch(() => setSizesCsv(e.target.value))
              }
              title="Rozmiar"
            >
              <option value="">Wszystkie rozmiary</option>
              {facets.sizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>

            <select
              className="min-w-[12rem] rounded border border-gray-300 px-3 py-2"
              value={conditionsCsv}
              onChange={(e) =>
                resetAndFetch(() => setConditionsCsv(e.target.value))
              }
              title="Stan"
            >
              <option value="">Wszystkie stany</option>
              {facets.conditions.map((condition) => (
                <option key={condition} value={condition}>
                  {condition}
                </option>
              ))}
            </select>

            <select
              className="min-w-[12rem] rounded border border-gray-300 px-3 py-2"
              value={shotsCsv}
              onChange={(e) => resetAndFetch(() => setShotsCsv(e.target.value))}
              title="Rzut"
            >
              <option value="">Wszystkie rzuty</option>
              {facets.shots.map((shot) => (
                <option key={shot} value={shot}>
                  {shot}
                </option>
              ))}
            </select>

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
            {listError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {listError}
              </div>
            )}
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
                          {[p.brand, p.size, p.condition, p.shot]
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
                {!items.length && !listError && (
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
                  <div className="space-y-4">
                    <div className="aspect-[4/5] overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                      {frontPhoto ? (
                        <button
                          type="button"
                          className="h-full w-full"
                          onClick={() => frontPhotoData && setPreviewPhoto(frontPhotoData)}
                          title="Powiększ zdjęcie główne"
                          disabled={photoBusy}
                        >
                          <img
                            src={frontPhoto}
                            alt={selected.title || 'Zdjęcie produktu'}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-gray-500">
                          Brak zdjęcia głównego
                        </div>
                      )}
                    </div>

                    <label
                      className={`inline-flex items-center justify-center gap-2 rounded border border-dashed border-gray-300 px-3 py-2 text-sm font-medium ${
                        photoBusy ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:border-gray-400'
                      }`}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={photoBusy}
                        onChange={(e) => {
                          const files = e.target.files;
                          void uploadPhotos(files);
                          e.currentTarget.value = '';
                        }}
                      />
                      <span>Dodaj zdjęcia</span>
                    </label>

                    {selected.photos.length ? (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {selected.photos.map((photo) => (
                          <div
                            key={photo.id}
                            className={`relative overflow-hidden rounded border ${
                              photo.isFront ? 'border-black' : 'border-gray-200'
                            }`}
                          >
                            <button
                              type="button"
                              className="block h-full w-full focus:outline-none"
                              onClick={() => setPreviewPhoto(photo)}
                              title="Powiększ zdjęcie"
                            >
                              <img
                                src={photo.url}
                                alt="Miniatura"
                                className="h-28 w-full object-cover"
                              />
                            </button>
                            <div className="absolute inset-x-0 bottom-1 flex justify-center gap-2 px-2">
                              {!photo.isFront && (
                                <button
                                  type="button"
                                  className="rounded bg-white/90 px-2 py-1 text-[10px]"
                                  onClick={() => void setPhotoAsFront(photo.id)}
                                  disabled={photoBusy}
                                >
                                  Ustaw główne
                                </button>
                              )}
                              <button
                                type="button"
                                className="rounded bg-white/90 px-2 py-1 text-[10px]"
                                onClick={() => void deletePhoto(photo.id)}
                                disabled={photoBusy}
                              >
                                Usuń
                              </button>
                            </div>
                            {photo.isFront && (
                              <span className="absolute left-1 top-1 rounded bg-black px-2 py-1 text-[10px] font-semibold text-white">
                                Główne
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      ) : (
                      <p className="text-sm text-gray-500">Brak dodanych zdjęć.</p>
                    )}

                    {photoBusy && (
                      <p className="text-xs text-gray-500">Przetwarzanie zdjęć…</p>
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
                        <span className="text-gray-600">Rzut</span>
                        <input
                          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                          value={shotInput}
                          onChange={(e) => setShotInput(e.target.value)}
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
                          inputMode="decimal"
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="block text-sm">
                        <span className="text-gray-600">Wymiar A</span>
                        <input
                          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                          value={dimensionAInput}
                          onChange={(e) => setDimensionAInput(e.target.value)}
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="text-gray-600">Wymiar B</span>
                        <input
                          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                          value={dimensionBInput}
                          onChange={(e) => setDimensionBInput(e.target.value)}
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="text-gray-600">Wymiar C</span>
                        <input
                          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                          value={dimensionCInput}
                          onChange={(e) => setDimensionCInput(e.target.value)}
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
                        disabled={saveBusy || photoBusy}
                      >
                        Zapisz zmiany
                      </button>
                      <button
                        type="button"
                        className="rounded border border-red-500 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        onClick={() => void deleteSelected()}
                        disabled={saveBusy || photoBusy}
                      >
                        Usuń produkt
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-4xl">
            <button
              type="button"
              className="absolute right-4 top-4 rounded bg-black/60 px-3 py-1 text-sm font-medium text-white hover:bg-black/80"
              onClick={() => setPreviewPhoto(null)}
            >
              Zamknij
            </button>
            <div className="max-h-[80vh] overflow-hidden rounded-lg bg-white p-2">
              <img
                src={previewPhoto.url}
                alt="Podgląd zdjęcia"
                className="max-h-[70vh] w-full rounded object-contain"
              />
            </div>
            <div className="mt-2 text-center text-sm text-white">
              {previewPhoto.isFront ? 'Zdjęcie główne' : 'Zdjęcie produktu'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
