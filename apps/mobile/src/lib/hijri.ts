/**
 * Hijri (Umm al-Qura) date through Intl. Returns null when the runtime has no Islamic calendar,
 * so the caller can hide the line instead of showing a Gregorian date mislabeled as Hijri.
 */
export function formatHijri(date: Date, locale: string): string | null {
  try {
    const format = new Intl.DateTimeFormat(`${locale}-u-ca-islamic-umalqura`, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (!format.resolvedOptions().calendar.startsWith("islamic")) return null;
    return format.format(date);
  } catch {
    return null;
  }
}
