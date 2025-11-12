// src/components/FiltersBar.tsx
"use client";

import { useMemo, useState } from "react";

type Props = {
  query: string;
  sort: string;
  statusCsv: string;     // "NA_MAGAZYNIE,WYSTAWIONE"
  brandsCsv: string;
  sizesCsv: string;
  conditionsCsv: string;
  facets: {
    brands: string[];
    sizes: string[];
    conditions: string[];
    statuses: string[];
  };
  onChange: (patch: Partial<{
    query: string;
    sort: string;
    statusCsv: string;
    brandsCsv: string;
    sizesCsv: string;
    conditionsCsv: string;
  }>) => void;
  onClear: () => void;
};

const STATUS_OPTIONS = [
  { value: "NA_MAGAZYNIE", label: "Na magazynie" },
  { value: "WYSTAWIONE", label: "Wystawione" },
  { value: "ZAREZERWOWANE", label: "Zarezerwowane" },
  { value: "SPRZEDANE", label: "Sprzedane" },
  { value: "ARCHIWUM", label: "Archiwum" },
];

export default function FiltersBar({
  query, sort, statusCsv, brandsCsv, sizesCsv, conditionsCsv, facets, onChange, onClear,
}: Props) {
  const [q, setQ] = useState(query);

  function csvToSet(csv: string): Set<string> {
    return new Set(csv ? csv.split(",").filter(Boolean) : []);
  }
  function toggleCsv(csv: string, v: string): string {
    const set = csvToSet(csv);
    set.has(v) ? set.delete(v) : set.add(v);
    return Array.from(set).join(",");
  }

  const selectedStatuses = useMemo(() => csvToSet(statusCsv), [statusCsv]);
  const selectedBrands = useMemo(() => csvToSet(brandsCsv), [brandsCsv]);
  const selectedSizes = useMemo(() => csvToSet(sizesCsv), [sizesCsv]);
  const selectedConds = useMemo(() => csvToSet(conditionsCsv), [conditionsCsv]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onChange({ query: q }); }}
        placeholder="Szukaj…"
        className="border rounded px-3 py-2"
      />

      <select
        className="border rounded px-2 py-2"
        value={sort}
        onChange={(e) => onChange({ sort: e.target.value })}
      >
        <option value="CREATED_DESC">Najnowsze</option>
        <option value="CREATED_ASC">Najstarsze</option>
        <option value="PRICE_DESC">Cena ↓</option>
        <option value="PRICE_ASC">Cena ↑</option>
      </select>

      {/* Status – poprawne wartości */}
      <div className="relative">
        <select
          className="border rounded px-2 py-2"
          value=""
          onChange={(e) =>
            onChange({ statusCsv: toggleCsv(statusCsv, e.target.value) })
          }
        >
          <option value="" disabled>
            — status —
          </option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {selectedStatuses.has(s.value) ? "✓ " : ""}{s.label}
            </option>
          ))}
        </select>
      </div>

      {/* BRANDS */}
      <div className="relative">
        <select
          className="border rounded px-2 py-2"
          value=""
          onChange={(e) =>
            onChange({ brandsCsv: toggleCsv(brandsCsv, e.target.value) })
          }
        >
          <option value="" disabled>— marka —</option>
          {facets.brands.map((b) => (
            <option key={b} value={b}>
              {selectedBrands.has(b) ? "✓ " : ""}{b}
            </option>
          ))}
        </select>
      </div>

      {/* SIZES */}
      <div className="relative">
        <select
          className="border rounded px-2 py-2"
          value=""
          onChange={(e) =>
            onChange({ sizesCsv: toggleCsv(sizesCsv, e.target.value) })
          }
        >
          <option value="" disabled>— rozmiar —</option>
          {facets.sizes.map((s) => (
            <option key={s} value={s}>
              {selectedSizes.has(s) ? "✓ " : ""}{s}
            </option>
          ))}
        </select>
      </div>

      {/* CONDITIONS */}
      <div className="relative">
        <select
          className="border rounded px-2 py-2"
          value=""
          onChange={(e) =>
            onChange({ conditionsCsv: toggleCsv(conditionsCsv, e.target.value) })
          }
        >
          <option value="" disabled>— stan —</option>
          {facets.conditions.map((c) => (
            <option key={c} value={c}>
              {selectedConds.has(c) ? "✓ " : ""}{c}
            </option>
          ))}
        </select>
      </div>

      <button
        className="px-3 py-2 rounded border hover:bg-gray-50"
        onClick={() => onChange({ query: q })}
      >
        Filtruj
      </button>

      <button
        className="px-3 py-2 rounded border hover:bg-gray-50"
        onClick={onClear}
      >
        Wyczyść
      </button>
    </div>
  );
}
