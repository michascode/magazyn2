// src/lib/format.ts
export function formatPrice(cents: number, currency: string = 'PLN') {
  try {
    return (cents / 100).toLocaleString('pl-PL', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}
