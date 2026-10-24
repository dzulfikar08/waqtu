import type { CivilDate } from "@waqtu/core";

/** Rupiah, no decimals. Indonesia-first: the app prices fidyah and zakat in IDR. */
export function formatRupiah(amount: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `Rp${Math.round(amount)}`;
  }
}

/** Number with at most `digits` decimals in the locale's separators. */
export function formatNumber(value: number, locale: string, digits = 2): string {
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  } catch {
    return String(value);
  }
}

/** "18 Februari 2026" style date for a civil date. */
export function formatCivilDate(date: CivilDate, locale: string): string {
  const instant = new Date(Date.UTC(date.year, date.month - 1, date.day, 12));
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(instant);
  } catch {
    return instant.toISOString().slice(0, 10);
  }
}
