export const PRODUCT_STATUSES = [
  "NA_MAGAZYNIE",
  "WYSTAWIONE",
  "ZAREZERWOWANE",
  "SPRZEDANE",
  "ARCHIWUM",
] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

const STATUS_SET = new Set<string>(PRODUCT_STATUSES);

export const DEFAULT_PRODUCT_STATUS: ProductStatus = PRODUCT_STATUSES[0];

export function isProductStatus(value: unknown): value is ProductStatus {
  return typeof value === "string" && STATUS_SET.has(value);
}

export function ensureProductStatus(
  value: unknown,
  fallback: ProductStatus = DEFAULT_PRODUCT_STATUS
): ProductStatus {
  return isProductStatus(value) ? value : fallback;
}

export function optionalProductStatus(
  value: unknown
): ProductStatus | undefined {
  if (!value) return undefined;
  return isProductStatus(value) ? value : undefined;
}