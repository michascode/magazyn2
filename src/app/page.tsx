'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Photo = { id: string; url: string; isFront: boolean; order: number };
type Product = {
  id: string; title: string; priceCents: number;
  brand?: string | null; size?: string | null; condition?: string | null;
  status: string; photos: Photo[];
};

export default function Page() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/products?limit=12', { cache: 'no-store' });
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async () => {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Nowy produkt', status: 'NA_MAGAZYNIE' }),
    });
    if (!res.ok) return alert(await res.text());
    const p: Product = await res.json();
    setSelected(p);
    await load();
  }, [load]);

  const onFiles = useCallback(async (ev: React.ChangeEvent<HTMLInputElement>) => {
    if (!selected) return;
    const files = ev.target.files;
    if (!files?.length) return;
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append('photos', f));
    const res = await fetch(`/api/products/${selected.id}/photos`, { method: 'POST', body: fd });
    if (!res.ok) return alert(await res.text());
    const p: Product = await res.json();
    setSelected(p);
    await load();
    ev.target.value = '';
  }, [selected, load]);

  const setFront = useCallback(async (p: Product, photoId: string) => {
    const res = await fetch(`/api/products/${p.id}/photos/${photoId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isFront: true }),
    });
    if (!res.ok) return alert(await res.text());
    await load();
  }, [load]);

  const removePhoto = useCallback(async (p: Product, photoId: string) => {
    const res = await fetch(`/api/products/${p.id}/photos/${photoId}`, { method: 'DELETE' });
    if (!res.ok) return alert(await res.text());
    await load();
  }, [load]);

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={create}
          className="rounded bg-black text-white px-4 py-2"
        >
          + Dodaj produkt
        </button>

        <label className="px-3 py-2 border rounded cursor-pointer">
          <input ref={inputRef} type="file" multiple hidden onChange={onFiles} />
          Dodaj zdjęcia do wybranego
        </label>

        {selected && <span className="text-sm text-gray-500">Wybrany: {selected.title}</span>}
      </div>

      {loading && <div>Ładowanie…</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map(p => {
          const ph = p.photos.find(x=>x.isFront) ?? p.photos[0];
          return (
            <div
              key={p.id}
              onClick={() => setSelected(p)}
              className={`border rounded p-2 ${selected?.id===p.id?'ring-2 ring-blue-500':''} cursor-pointer`}
            >
              <div className="aspect-square bg-gray-100 rounded mb-2 overflow-hidden">
                {ph ? <img src={ph.url} className="w-full h-full object-cover" /> : <div className="flex h-full items-center justify-center text-gray-400">brak zdjęć</div>}
              </div>
              <div className="text-sm font-medium">{p.title}</div>
              <div className="text-xs text-gray-500">{p.status}</div>

              {p.photos.length>0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {p.photos.map(pic => (
                    <div key={pic.id} className="relative">
                      <img src={pic.url} className={`w-14 h-14 object-cover rounded ${pic.isFront?'ring-2 ring-blue-500':''}`} />
                      <div className="flex gap-1 mt-1">
                        <button className="text-xs underline" onClick={(e)=>{e.stopPropagation(); setFront(p, pic.id);}}>front</button>
                        <button className="text-xs text-red-600 underline" onClick={(e)=>{e.stopPropagation(); removePhoto(p, pic.id);}}>usuń</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
