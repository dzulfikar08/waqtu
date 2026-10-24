import type { CivilDate } from "@waqtu/core";

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD", the key daily rows are stored under. */
export function toIso(date: CivilDate): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

/** "H:MM:SS" (or "MM:SS" below an hour) for a countdown. Negative values clamp to zero. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
