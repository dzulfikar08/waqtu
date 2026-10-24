/**
 * Checklist model. One entry per (day, item); `value` is an integer so it syncs as-is:
 * - `fardh`: bit flags below (0 = nothing recorded),
 * - `check`: 0 / 1,
 * - `count`: a non-negative number (pages of tilawah, ...).
 */
export const FLAG = { DONE: 1, ONTIME: 2, JAMAAH: 4, QADHA: 8 } as const;

export type ItemKind = "fardh" | "check" | "count";

export interface ItemDef {
  /** Built-in ids are fixed; custom ids start with `c.`. Matches the server's `^[A-Za-z0-9._:-]{1,64}$`. */
  id: string;
  kind: ItemKind;
  /** Only custom items carry a label; built-ins are translated by id. */
  label?: string;
}

export const FARDH_IDS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type FardhId = (typeof FARDH_IDS)[number];

export const BUILTIN_ITEMS: readonly ItemDef[] = [
  ...FARDH_IDS.map((id): ItemDef => ({ id, kind: "fardh" })),
  { id: "rawatib", kind: "check" },
  { id: "dhuha", kind: "check" },
  { id: "tahajjud", kind: "check" },
  { id: "tilawah", kind: "count" },
  { id: "dzikir_pagi", kind: "check" },
  { id: "dzikir_petang", kind: "check" },
  { id: "sedekah", kind: "check" },
  { id: "puasa", kind: "check" },
  // Recorded when a halaqah session is finished. Not in the default checklist (Ramadhan only); users add it from the item manager.
  { id: "halaqah", kind: "check" },
];

/** What a fresh install shows: every built-in except the seasonal `halaqah`. */
export const DEFAULT_ITEMS: readonly ItemDef[] = BUILTIN_ITEMS.filter(
  (item) => item.id !== "halaqah",
);

export const MAX_LABEL = 40;
export const MAX_COUNT = 10_000;

const BUILTIN_BY_ID = new Map(BUILTIN_ITEMS.map((item) => [item.id, item]));
const KINDS: readonly string[] = ["fardh", "check", "count"];
const CUSTOM_ID = /^c\.[a-z0-9]{4,32}$/;

export function isBuiltinId(id: string): boolean {
  return BUILTIN_BY_ID.has(id);
}

/** Built-in items the user removed and could add back. */
export function missingBuiltins(items: readonly ItemDef[]): ItemDef[] {
  const have = new Set(items.map((item) => item.id));
  return BUILTIN_ITEMS.filter((item) => !have.has(item.id));
}

/** Stored `items` setting → list. Anything malformed falls back to the default items rather than an empty checklist. */
export function parseItems(raw: string | null | undefined): ItemDef[] {
  if (!raw) return [...DEFAULT_ITEMS];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [...DEFAULT_ITEMS];
  }
  if (!Array.isArray(data)) return [...DEFAULT_ITEMS];
  const seen = new Set<string>();
  const items: ItemDef[] = [];
  for (const entry of data) {
    if (typeof entry !== "object" || entry === null) continue;
    const { id, kind, label } = entry as Record<string, unknown>;
    if (typeof id !== "string" || seen.has(id)) continue;
    const builtin = BUILTIN_BY_ID.get(id);
    if (builtin) {
      seen.add(id);
      items.push(builtin);
    } else if (
      CUSTOM_ID.test(id) &&
      typeof kind === "string" &&
      KINDS.includes(kind) &&
      kind !== "fardh" &&
      typeof label === "string" &&
      label.trim().length > 0
    ) {
      seen.add(id);
      items.push({ id, kind: kind as ItemKind, label: label.trim().slice(0, MAX_LABEL) });
    }
  }
  return items;
}

export function serializeItems(items: readonly ItemDef[]): string {
  return JSON.stringify(
    items.map(({ id, kind, label }) => (label ? { id, kind, label } : { id, kind })),
  );
}

/** `random` yields a base-36 token; injected so tests are deterministic. */
export function addCustomItem(
  items: readonly ItemDef[],
  label: string,
  kind: Exclude<ItemKind, "fardh">,
  random: () => string,
): ItemDef[] {
  const trimmed = label.trim().slice(0, MAX_LABEL);
  if (!trimmed) return [...items];
  let id = `c.${random()}`;
  while (items.some((item) => item.id === id)) id = `c.${random()}`;
  return [...items, { id, kind, label: trimmed }];
}

export function addBuiltinItem(items: readonly ItemDef[], id: string): ItemDef[] {
  const builtin = BUILTIN_BY_ID.get(id);
  if (!builtin || items.some((item) => item.id === id)) return [...items];
  return [...items, builtin];
}

export function removeItem(items: readonly ItemDef[], id: string): ItemDef[] {
  return items.filter((item) => item.id !== id);
}

/** Whether an item counts as done for a streak or a summary. */
export function isDone(kind: ItemKind, value: number): boolean {
  return kind === "fardh" ? (value & FLAG.DONE) !== 0 : value > 0;
}

export type FardhAction = "done" | "ontime" | "jamaah" | "qadha";

/**
 * Next flags after a tap. Marking a prayer done means on time; "qadha" records it as made up
 * later (and clears on time); each chip toggles; unmarking "done" clears everything.
 */
export function toggleFardh(value: number, action: FardhAction): number {
  const done = (value & FLAG.DONE) !== 0;
  switch (action) {
    case "done":
      return done ? 0 : FLAG.DONE | FLAG.ONTIME;
    case "ontime":
      if (!done) return FLAG.DONE | FLAG.ONTIME;
      return (value & FLAG.ONTIME ? value & ~FLAG.ONTIME : value | FLAG.ONTIME) & ~FLAG.QADHA;
    case "jamaah":
      if (!done) return FLAG.DONE | FLAG.ONTIME | FLAG.JAMAAH;
      return value ^ FLAG.JAMAAH;
    case "qadha":
      if (value & FLAG.QADHA) return value & ~FLAG.QADHA;
      return (value | FLAG.DONE | FLAG.QADHA) & ~FLAG.ONTIME;
  }
}

/** Notification action "Sudah sholat": done, and on time when still inside the prayer's window. */
export function markedFromNotification(value: number, onTime: boolean): number {
  if ((value & FLAG.DONE) !== 0) return value;
  return onTime ? FLAG.DONE | FLAG.ONTIME : FLAG.DONE;
}

export function clampCount(n: number): number {
  return Math.max(0, Math.min(MAX_COUNT, Math.trunc(n)));
}
