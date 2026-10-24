import { addDays, diffDays, isDayKey, type DayKey } from "./dates";
import { isDone, type ItemDef } from "./items";

export interface PauseRange {
  from: DayKey;
  /** Inclusive; null while the pause is still running. */
  to: DayKey | null;
}

export interface StreakConfig {
  /** Missed days forgiven per rolling 7 days without breaking the streak. */
  graceDays: number;
  /** Items to record on a day for it to count. */
  minDone: number;
  pauses: PauseRange[];
}

export const DEFAULT_STREAK_CONFIG: StreakConfig = { graceDays: 1, minDone: 3, pauses: [] };
export const MAX_GRACE_DAYS = 3;
export const GRACE_WINDOW_DAYS = 7;
const MAX_PAUSES = 50;

export interface StreakResult {
  /** Days counted in the running streak. Forgiven and paused days do not add, and do not break. */
  current: number;
  best: number;
  /** Misses forgiven inside the running streak. */
  forgiven: number;
  /** Misses still available in the 7 days ending today. */
  graceLeft: number;
  paused: boolean;
  countedToday: boolean;
}

export interface EntryLike {
  date: DayKey;
  itemId: string;
  value: number;
}

/** Days with at least `minDone` of the enabled items recorded (never more than the number enabled). */
export function countedDays(
  entries: readonly EntryLike[],
  items: readonly ItemDef[],
  minDone: number,
): Set<DayKey> {
  const kinds = new Map(items.map((item) => [item.id, item.kind]));
  const need = Math.max(1, Math.min(minDone, items.length));
  const perDay = new Map<DayKey, number>();
  for (const entry of entries) {
    const kind = kinds.get(entry.itemId);
    if (kind && isDone(kind, entry.value)) {
      perDay.set(entry.date, (perDay.get(entry.date) ?? 0) + 1);
    }
  }
  const days = new Set<DayKey>();
  for (const [day, n] of perDay) if (n >= need) days.add(day);
  return days;
}

function isPaused(day: DayKey, pauses: readonly PauseRange[]): boolean {
  return pauses.some((p) => day >= p.from && (p.to === null || day <= p.to));
}

export function computeStreak(
  counted: ReadonlySet<DayKey>,
  today: DayKey,
  config: StreakConfig,
): StreakResult {
  const countedToday = counted.has(today);
  const paused = isPaused(today, config.pauses);
  let first: DayKey | null = null;
  for (const day of counted) if (day <= today && (first === null || day < first)) first = day;
  if (first === null) {
    return { current: 0, best: 0, forgiven: 0, graceLeft: config.graceDays, paused, countedToday };
  }

  let current = 0;
  let best = 0;
  let forgiven: DayKey[] = [];
  const span = diffDays(today, first);
  for (let i = 0; i <= span; i++) {
    const day = addDays(first, i);
    if (isPaused(day, config.pauses)) continue;
    if (counted.has(day)) {
      current++;
      if (current > best) best = current;
    } else if (day === today) {
      // Today is still open: not a miss yet.
    } else if (current > 0) {
      const recent = forgiven.filter((f) => diffDays(day, f) < GRACE_WINDOW_DAYS).length;
      if (recent < config.graceDays) forgiven.push(day);
      else {
        current = 0;
        forgiven = [];
      }
    }
  }

  const used = forgiven.filter((f) => diffDays(today, f) < GRACE_WINDOW_DAYS).length;
  return {
    current,
    best,
    forgiven: forgiven.length,
    graceLeft: Math.max(0, config.graceDays - used),
    paused,
    countedToday,
  };
}

export function startPause(config: StreakConfig, today: DayKey): StreakConfig {
  if (isPaused(today, config.pauses)) return config;
  return { ...config, pauses: [...config.pauses, { from: today, to: null }].slice(-MAX_PAUSES) };
}

/** Resume from `today`: the pause covers up to yesterday, and a pause that began today vanishes. */
export function endPause(config: StreakConfig, today: DayKey): StreakConfig {
  const yesterday = addDays(today, -1);
  const pauses: PauseRange[] = [];
  for (const p of config.pauses) {
    const running = p.to === null || p.to >= today;
    if (!running || p.from > today) pauses.push(p);
    else if (p.from <= yesterday) pauses.push({ from: p.from, to: yesterday });
  }
  return { ...config, pauses };
}

export function parseStreakConfig(raw: string | null | undefined): StreakConfig {
  if (!raw) return DEFAULT_STREAK_CONFIG;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return DEFAULT_STREAK_CONFIG;
  }
  if (typeof data !== "object" || data === null) return DEFAULT_STREAK_CONFIG;
  const { graceDays, minDone, pauses } = data as Record<string, unknown>;
  const int = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : fallback;
  const ranges: PauseRange[] = [];
  if (Array.isArray(pauses)) {
    for (const p of pauses) {
      if (typeof p !== "object" || p === null) continue;
      const { from, to } = p as Record<string, unknown>;
      if (!isDayKey(from)) continue;
      if (to === null) ranges.push({ from, to: null });
      else if (isDayKey(to) && to >= from) ranges.push({ from, to });
    }
  }
  return {
    graceDays: int(graceDays, 0, MAX_GRACE_DAYS, DEFAULT_STREAK_CONFIG.graceDays),
    minDone: int(minDone, 1, 99, DEFAULT_STREAK_CONFIG.minDone),
    pauses: ranges.slice(-MAX_PAUSES),
  };
}

export function serializeStreakConfig(config: StreakConfig): string {
  return JSON.stringify(config);
}
