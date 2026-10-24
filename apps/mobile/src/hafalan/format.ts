import {
  refOfIndex,
  surahInfo,
  type DailyPortion,
  type HafalanTarget,
  type HafalanUnit,
} from "@waqtu/core";

/** Arabic-Indic digits, as the mushaf prints ayah numbers. */
export function arabicDigits(n: number): string {
  return String(n).replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));
}

/** Surah name for the language: the Indonesian transliteration always, plus the English meaning in English. */
export function surahName(surah: number, lang: "id" | "en"): string {
  const info = surahInfo(surah);
  return lang === "en" ? `${info.id} (${info.en})` : info.id;
}

/** `An-Naba' 1–16`, or `An-Naba' 40 – An-Nazi'at 5` when the unit crosses a surah. */
export function unitLabel(unit: Pick<HafalanUnit, "start" | "end">): string {
  const a = refOfIndex(unit.start);
  const b = refOfIndex(unit.end);
  const first = surahInfo(a.surah).id;
  if (a.surah === b.surah) {
    return a.ayah === b.ayah ? `${first} ${a.ayah}` : `${first} ${a.ayah}–${b.ayah}`;
  }
  return `${first} ${a.ayah} – ${surahInfo(b.surah).id} ${b.ayah}`;
}

/** Distinct mushaf pages a plan's units lie on. */
export function pagesSpanned(units: readonly Pick<HafalanUnit, "page">[]): number {
  return new Set(units.map((u) => u.page)).size;
}

/** The range typed in the plan form, `to` defaulting to `from`; null when `from` is missing. */
export function targetFromInput(
  kind: HafalanTarget["kind"],
  from: number | null,
  to: number | null,
): HafalanTarget | null {
  if (from === null) return null;
  return { kind, from, to: to ?? from };
}

export type UnitRole = "sabaq" | "murojaah" | "done" | "other";

/** What a unit is for today: new, review, finished today, or neither. */
export function unitRole(portion: DailyPortion, unit: number): UnitRole {
  if (portion.sabaq.todo.includes(unit)) return "sabaq";
  if (portion.murojaah.todo.includes(unit)) return "murojaah";
  if (portion.sabaq.done.includes(unit) || portion.murojaah.done.includes(unit)) return "done";
  return "other";
}

/** Next unit still to do after `unit` in today's lists (new portion first), or null when none is left. */
export function nextTodo(portion: DailyPortion, unit: number): number | null {
  const todo = [...portion.sabaq.todo, ...portion.murojaah.todo].filter((u) => u !== unit);
  return todo[0] ?? null;
}

/** `m:ss` for a recording length. */
export function formatSeconds(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
