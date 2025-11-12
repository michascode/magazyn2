// src/app/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Photo = {
  id: string;
  productId: string;
  url: string;
  isFront: boolean;
  order: number | null;
  createdAt: string;
};

type Product = {
  id: string;
  title: string;
  brand: string | null;
  size: string | null;
  condition: string | null;
  status: string;
  priceCents: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  photos: Photo[];
};

type Facets = {
  brands: string[];
  sizes: string[];
  conditions: string[];
  statuses: string[];
};

type ListResp = {
  total: number;
  page: number;
  limit: number;
  lastPage: number;
  items: Product[];
  facets: Facets;
};

export default function Page() {
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [lastPage, setLastPage] = useState(1);
  const [facets, setFacets] = useState<Facets>({
    brands: [],
    sizes: [],
    conditions: [],
    statuses: [],
  });

  const [query, setQuery] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedConds, setSelectedConds] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [sort, setSort] = useState("CREATED_DESC");

  const loadingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (query.trim()) p.set("query", query.trim());
    if (selectedBrands.length) p.set("brands", selectedBrands.join(","));
    if (selectedSizes.length) p.set("sizes", selectedSizes.join(","));
    if (selectedConds.length) p.set("conditions", selectedConds.join(","));
    if (selectedStatuses.length) p.set("statuses", selectedStatuses.join(","));
    p.set("sort", sort);
    p.set("page", String(page));
    p.set("limit", String(limit));
    return p.toString();
  }, [
    query,
    selectedBrands,
    selectedSizes,
    selectedConds,
    selectedStatuses,
    sort,
    page,
    limit,
  ]);

  const load = useCallback(
    async (mode: "reset" | "append" = "reset") => {
      if (loadingRef.current) return;
      loadingRef.current = true;

      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const res = await fetch(`/api/products?${qs}`, {
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as ListResp;

        setTotal(data.total);
        setLastPage(data.lastPage);
        setFacets(data.facets);

        setItems((prev) =>
          mode === "append" ? [...prev, ...data.items] : data.items
        );
      } finally {
        loadingRef.current = false;
      }
    },
    [qs]
  );

  // pierwszy załadunek + każda zmiana filtrów/sort/page
  useEffect(() => {
    load("reset");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  const loadMore = () => {
    if (page < lastPage) setPage((p) => p + 1);
  };

  // kiedy rośnie page -> dołóż elementy
  useEffect(() => {
    if (page > 1) load("append");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <main className="p-4 max-w-6xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Magazyn</h1>

      {/* Bardzo prosty panel filtrów (dla testów) */}
      <section className="flex flex-wrap gap-2 items-center">
        <input
          className="border px-2 py-1 rounded"
          placeholder="Szukaj…"
          value={query}
          onChange={(e) => {
            setPage(1);
            setQuery(e.target.value);
          }}
        />

        <select
          className="border px-2 py-1 rounded"
          value={sort}
          onChange={(e) => {
            setPage(1);
            setSort(e.target.value);
          }}
        >
          <option value="CREATED_DESC">Najnowsze</option>
          <option value="CREATED_ASC">Najstarsze</option>
          <option value="PRICE_DESC">Cena ↓</option>
          <option value="PRICE_ASC">Cena ↑</option>
        </select>

        {/* na szybko: filtr po statusie */}
        <select
          className="border px-2 py-1 rounded"
          value={selectedStatuses[0] ?? ""}
          onChange={(e) => {
            setPage(1);
            setSelectedStatuses(e.target.value ? [e.target.value] : []);
          }}
        >
          <option value="">— status —</option>
          {facets.statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <span className="ml-auto text-sm opacity-70">
          {total} wyników • strona {page}/{lastPage}
        </span>
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {items.map((p) => {
          const cover =
            p.photos.find((ph) => ph.isFront) ?? p.photos[0] ?? null;

          return (
            <article
              key={p.id}
              className="border rounded-lg overflow-hidden bg-white"
            >
              {cover ? (
                <img
                  key={cover.id}
                  src={cover.url}
                  alt={p.title}
                  className="w-full aspect-square object-cover"
                />
              ) : (
                <div className="w-full aspect-square bg-gray-100" />
              )}
              <div className="p-2 space-y-1">
                <div className="text-sm font-medium line-clamp-2">
                  {p.title}
                </div>
                <div className="text-xs opacity-70">
                  {p.brand ?? "—"} • {p.size ?? "—"}
                </div>
                <div className="text-xs">{(p.priceCents / 100).toFixed(2)} zł</div>
                <div className="text-[10px] uppercase opacity-60">{p.status}</div>
              </div>
            </article>
          );
        })}
      </section>

      {page < lastPage && (
        <div className="flex justify-center">
          <button
            className="px-3 py-1 border rounded"
            onClick={loadMore}
            disabled={loadingRef.current}
          >
            Załaduj więcej
          </button>
        </div>
      )}
    </main>
  );
}
