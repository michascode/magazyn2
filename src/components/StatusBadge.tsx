"use client";

type Props = { status?: string | null };

const COLORS: Record<string, string> = {
  NA_MAGAZYNIE: "bg-gray-200 text-gray-800",
  WYSTAWIONE: "bg-blue-100 text-blue-800",
  ZAREZERWOWANE: "bg-yellow-100 text-yellow-800",
  SPRZEDANE: "bg-green-100 text-green-800",
  ARCHIWUM: "bg-zinc-300 text-zinc-700",
};

export function StatusBadge({ status }: Props) {
  const klass =
    COLORS[status ?? ""] ?? "bg-gray-100 text-gray-800 border border-gray-200";
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${klass}`}>
      {status ?? "—"}
    </span>
  );
}
