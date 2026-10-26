import type { DayKey } from "../mutabaah/dates";
import type { DayPeriod } from "../prayer/period";

import type { ReaderItem, ReaderSession, ReaderTime, SessionId } from "./content";

/** How many times each item (by key) has been recited in this sitting. Missing keys are 0. */
export type Counts = Readonly<Record<string, number>>;

export function doneCount(counts: Counts, item: ReaderItem): number {
  const n = counts[item.key] ?? 0;
  return Math.min(Math.max(0, n), item.repeat);
}

/** What is left of an item: the number on its counter, counting down to 0. */
export function remaining(counts: Counts, item: ReaderItem): number {
  return item.repeat - doneCount(counts, item);
}

export function isItemDone(counts: Counts, item: ReaderItem): boolean {
  return remaining(counts, item) === 0;
}

/** One tap on an item's counter: one recitation done. A finished item stays finished. */
export function tapItem(counts: Counts, item: ReaderItem): Counts {
  if (isItemDone(counts, item)) return counts;
  return { ...counts, [item.key]: doneCount(counts, item) + 1 };
}

/** Puts an item's counter back to its full count. */
export function resetItem(counts: Counts, item: ReaderItem): Counts {
  if (!(item.key in counts)) return counts;
  const rest = { ...counts };
  delete rest[item.key];
  return rest;
}

export interface SessionProgress {
  /** Recitations done, counting each repetition. */
  done: number;
  total: number;
  itemsDone: number;
  itemsTotal: number;
  /** done / total, 0 to 1. */
  fraction: number;
  complete: boolean;
}

export function sessionProgress(session: ReaderSession, counts: Counts): SessionProgress {
  let done = 0;
  let total = 0;
  let itemsDone = 0;
  for (const item of session.items) {
    done += doneCount(counts, item);
    total += item.repeat;
    if (isItemDone(counts, item)) itemsDone++;
  }
  return {
    done,
    total,
    itemsDone,
    itemsTotal: session.items.length,
    fraction: total > 0 ? done / total : 0,
    complete: total > 0 && done === total,
  };
}

/** Index of the first unfinished item after `from` (wrapping round), or null when all are finished. */
export function nextOpenItem(session: ReaderSession, counts: Counts, from: number): number | null {
  const n = session.items.length;
  for (let step = 1; step <= n; step++) {
    const index = (from + step) % n;
    if (!isItemDone(counts, session.items[index])) return index;
  }
  return null;
}

/** The settings key the progress of one session is kept under (device-local, never synced). */
export function progressKey(id: SessionId): string {
  return `ibadah.progress.${id}`;
}

/** Stored progress → today's counts. Progress from another day, or anything malformed, starts afresh. */
export function parseProgress(raw: string | null | undefined, today: DayKey): Counts {
  if (!raw) return {};
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null || !("day" in data) || !("counts" in data)) {
      return {};
    }
    if (data.day !== today) return {};
    const stored = data.counts;
    if (typeof stored !== "object" || stored === null) return {};
    const counts: Record<string, number> = {};
    for (const [key, value] of Object.entries(stored)) {
      if (typeof value === "number" && Number.isInteger(value) && value > 0) counts[key] = value;
    }
    return counts;
  } catch {
    return {};
  }
}

export function serializeProgress(counts: Counts, today: DayKey): string {
  return JSON.stringify({ day: today, counts });
}

/**
 * Morning or evening, from the part of the day: from Subuh until Asr the morning adhkar, from Asr through the night the
 * evening ones.
 */
export function suggestedTime(period: DayPeriod): ReaderTime {
  return period === "fajr" || period === "sunrise" || period === "dhuhr" ? "pagi" : "petang";
}

/** The mutabaah checklist item a finished morning or evening session can tick. */
export function mutabaahItemFor(time: ReaderTime): "dzikir_pagi" | "dzikir_petang" {
  return time === "pagi" ? "dzikir_pagi" : "dzikir_petang";
}
