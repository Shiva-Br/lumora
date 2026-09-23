/** The single number locale the chat surfaces render with today. */
export const NUMBER_LOCALE = 'en-US';

/** Grouped plain number — `12,499`. */
export function formatNumber(amount: number): string {
  return amount.toLocaleString(NUMBER_LOCALE);
}

/**
 * Money with its verified currency — `AED 3,199`. A missing currency renders
 * as the bare number: the backend omits what it could not verify, and we
 * never invent a currency code for it.
 */
export function formatMoney(amount: number, currency?: string): string {
  const value = formatNumber(amount);
  return currency ? `${currency} ${value}` : value;
}

/** A verified min–max span — `AED 3,199 – 3,499`; one-sided spans collapse. */
export function formatMoneyRange(
  min: number | undefined,
  max: number | undefined,
  currency?: string
): string | null {
  if (min !== undefined && max !== undefined) {
    return `${formatMoney(min, currency)} – ${formatNumber(max)}`;
  }
  const single = min ?? max;
  return single === undefined ? null : formatMoney(single, currency);
}

/** Short date — `12 Aug 2026` — for footers and provenance lines. */
export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(NUMBER_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
