/* eslint-disable @next/next/no-img-element */
// src/app/products/[id]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/format';
import { PRODUCT_STATUSES, ensureProductStatus } from '@/lib/product-status';

type Photo = { id: string; url: string; isFront: boolean };
type Product = {
  id: string;
  title: string;
  brand: string | null;
  size: string | null;
  condition: string | null;
  status: string;
  priceCents: number;
  notes: string | null;
  photos: Photo[];
};


export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const id = useMemo(() => params?.id as string, [params]);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);

  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('');
  const [condition, setCondition] = useState('');
  const [status, setStatus] = useState(PRODUCT_STATUSES[0]);
  const [price, setPrice] = useState('0');
  const [notes, setNotes] = useState('');

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/products/${id}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Product;
      setProduct(data);
      setTitle(data.title ?? '');
      setBrand(data.brand ?? '');
      setSize(data.size ?? '');
      setCondition(data.condition ?? '');
      setStatus(ensureProductStatus(data.status));
      setPrice(String((data.priceCents ?? 0) / 100));
      setNotes(data.notes ?? '');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Błąd';
      setErr(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function save() {
    if (!product) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          brand: brand || null,
          size: size || null,
          condition: condition || null,
          status,
          priceCents: Math.max(0, Math.round(Number(price || '0') * 100)),
          notes: notes || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Product;
      setProduct(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Błąd zapisu';
      alert(message);
    } finally {
      setBusy(false);
    }
  }

  async function removeProduct() {
    if (!product) return;
    if (!confirm('Usunąć produkt?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      router.push('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Błąd';
      alert(message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(file: File) {
    if (!product || !file) return;
    const fd = new FormData();
    fd.append('file', file);
    setBusy(true);
    try {
      const res = await fetch(`/api/products/${product.id}/photos`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Błąd uploadu';
      alert(message);
    } finally {
      setBusy(false);
    }
  }

  async function setFront(photoId: string) {
    if (!product) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/products/${product.id}/photos/${photoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFront: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Błąd';
      alert(message);
    } finally {
      setBusy(false);
    }
  }

  async function deletePhoto(photoId: string) {
    if (!product) return;
    if (!confirm('Usunąć zdjęcie?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/products/${product.id}/photos/${photoId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Błąd';
      alert(message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6">Ładowanie…</div>;
  if (err) return <div className="p-6 text-red-600">Błąd: {err}</div>;
  if (!product) return <div className="p-6">Nie znaleziono.</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Produkt</h1>
        <button className="ml-auto border px-3 py-2 rounded disabled:opacity-50" disabled={busy} onClick={removeProduct}>
          Usuń produkt
        </button>
        <button className="bg-black text-white px-3 py-2 rounded disabled:opacity-50" disabled={busy} onClick={save}>
          Zapisz
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* formularz */}
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm">Nazwa</span>
            <input className="mt-1 w-full border rounded px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-sm">Marka</span>
              <input className="mt-1 w-full border rounded px-3 py-2" value={brand} onChange={(e) => setBrand(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm">Rozmiar</span>
              <input className="mt-1 w-full border rounded px-3 py-2" value={size} onChange={(e) => setSize(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm">Stan</span>
              <input className="mt-1 w-full border rounded px-3 py-2" value={condition} onChange={(e) => setCondition(e.target.value)} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm">Status</span>
              <select className="mt-1 w-full border rounded px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
                {PRODUCT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm">Cena</span>
              <input
                className="mt-1 w-full border rounded px-3 py-2"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              <div className="text-xs text-gray-500 mt-1">Wyświetlona: <strong>{formatPrice(Math.max(0, Math.round(Number(price || '0') * 100)))}</strong></div>
            </label>
          </div>

          <label className="block">
            <span className="text-sm">Notatki</span>
            <textarea className="mt-1 w-full border rounded px-3 py-2" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>

        {/* zdjęcia */}
        <div>
          <div className="mb-3">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadPhoto(f);
                  e.currentTarget.value = '';
                }}
              />
              <span className="border px-3 py-2 rounded">Dodaj zdjęcie</span>
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {product.photos.map((ph) => (
              <div key={ph.id} className="relative rounded border overflow-hidden">
                <img src={ph.url} alt="" className="h-40 w-full object-cover" />
                <div className="absolute bottom-2 left-2 flex gap-2">
                  {!ph.isFront && (
                    <button
                      className="text-[10px] px-2 py-1 rounded bg-white/90"
                      onClick={() => setFront(ph.id)}
                      disabled={busy}
                      title="Ustaw jako główne"
                    >
                      Główne
                    </button>
                  )}
                  <button
                    className="text-[10px] px-2 py-1 rounded bg-white/90"
                    onClick={() => deletePhoto(ph.id)}
                    disabled={busy}
                  >
                    Usuń
                  </button>
                </div>
                {ph.isFront && <div className="absolute top-2 left-2 text-[10px] bg-black text-white px-2 py-1 rounded">FRONT</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
