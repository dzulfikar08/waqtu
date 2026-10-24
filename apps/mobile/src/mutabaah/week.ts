import { lastDays, type DayKey } from "./dates";
import { FLAG, isDone, type ItemDef } from "./items";
import type { EntryLike } from "./streak";

export interface DaySummary {
  date: DayKey;
  done: number;
  total: number;
  /** Reached the streak threshold. */
  counted: boolean;
}

export interface ItemWeek {
  id: string;
  daysDone: number;
}

export interface WeekSummary {
  days: DaySummary[];
  countedDays: number;
  fardhEnabled: number;
  fardhDone: number;
  fardhOnTime: number;
  fardhJamaah: number;
  fardhQadha: number;
  /** Sum of the `tilawah` item, 0 when it is not on the checklist. */
  pages: number;
  /** Items sorted by days done, most first (ties keep checklist order). */
  items: ItemWeek[];
  bestDay: DayKey | null;
}

/** Seven days ending at `end` (usually today). */
export function summarizeWeek(
  entries: readonly EntryLike[],
  items: readonly ItemDef[],
  end: DayKey,
  minDone: number,
): WeekSummary {
  const days = lastDays(end, 7);
  const inWeek = new Set(days);
  const kinds = new Map(items.map((item) => [item.id, item.kind]));
  const need = Math.max(1, Math.min(minDone, items.length));
  const doneByDay = new Map<DayKey, number>();
  const daysByItem = new Map<string, number>();
  let fardhDone = 0;
  let fardhOnTime = 0;
  let fardhJamaah = 0;
  let fardhQadha = 0;
  let pages = 0;

  for (const entry of entries) {
    if (!inWeek.has(entry.date)) continue;
    const kind = kinds.get(entry.itemId);
    if (!kind || !isDone(kind, entry.value)) continue;
    doneByDay.set(entry.date, (doneByDay.get(entry.date) ?? 0) + 1);
    daysByItem.set(entry.itemId, (daysByItem.get(entry.itemId) ?? 0) + 1);
    if (kind === "fardh") {
      fardhDone++;
      if (entry.value & FLAG.ONTIME) fardhOnTime++;
      if (entry.value & FLAG.JAMAAH) fardhJamaah++;
      if (entry.value & FLAG.QADHA) fardhQadha++;
    }
    if (entry.itemId === "tilawah") pages += entry.value;
  }

  const summaries = days.map((date): DaySummary => {
    const done = doneByDay.get(date) ?? 0;
    return { date, done, total: items.length, counted: done >= need };
  });
  let bestDay: DayKey | null = null;
  let bestDone = 0;
  for (const s of summaries) {
    if (s.done > bestDone) {
      bestDone = s.done;
      bestDay = s.date;
    }
  }
  return {
    days: summaries,
    countedDays: summaries.filter((s) => s.counted).length,
    fardhEnabled: items.filter((item) => item.kind === "fardh").length,
    fardhDone,
    fardhOnTime,
    fardhJamaah,
    fardhQadha,
    pages,
    items: items
      .map((item) => ({ id: item.id, daysDone: daysByItem.get(item.id) ?? 0 }))
      .sort((a, b) => b.daysDone - a.daysDone),
    bestDay,
  };
}
