import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { formatPrice } from "@/lib/format";

export type UIPhoto = {
  url: string;
  isFront?: boolean | null;
  order?: number | null;
  createdAt?: string | Date | null;
};

export type UIProduct = {
  id: string;
  title: string;
  brand?: string | null;
  size?: string | null;
  condition?: string | null;
  status?: string | null;
  priceCents: number;
  photos: UIPhoto[];
};

function pickFront(photos: UIPhoto[]): string | null {
  if (!photos?.length) return null;
  const byFront = photos.find((p) => p.isFront);
  if (byFront) return byFront.url;
  const sorted = [...photos].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );
  return sorted[0]?.url ?? null;
}

export default function ProductCard({ p }: { p: UIProduct }) {
  const img = pickFront(p.photos);

  return (
    <Link
      href={`/products/${p.id}`}
      className="group block overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:shadow"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-gray-100">
        {img ? (
          // możesz podmienić na <Image> jeśli chcesz
          <img
            src={img}
            alt={p.title || "product"}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full bg-gray-100" />
        )}

        <div className="absolute left-2 top-2">
          <StatusBadge status={p.status} />
        </div>
      </div>

      <div className="space-y-1 p-3">
        <div className="line-clamp-1 text-sm font-medium">{p.title}</div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {p.brand && <span className="line-clamp-1">{p.brand}</span>}
          {p.size && (
            <>
              <span>•</span>
              <span>{p.size}</span>
            </>
          )}
        </div>
        {p.condition && (
          <div className="text-xs text-gray-500">{p.condition}</div>
        )}
        <div className="pt-1 text-sm">
          <strong>{formatPrice(p.priceCents)}</strong>
        </div>
      </div>
    </Link>
  );
}
