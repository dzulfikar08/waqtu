/**
 * Ayah marks of a recitation recording: `marks[i]` is the second at which the unit's `i`-th ayah
 * (counted from 0 within the unit) starts. The first mark is always 0. A recording without marks
 * (made before marks existed, or never stepped with "Next ayah") has an empty list.
 */
export type AyahMarks = readonly number[];

/**
 * Adds the start of the next ayah at `seconds` while recording. Ignored once every ayah of the unit
 * has a mark or when the time would go backwards.
 */
export function addMark(marks: AyahMarks, seconds: number, ayahCount: number): AyahMarks {
  const last = marks.at(-1) ?? 0;
  if (marks.length === 0 || marks.length >= ayahCount || seconds < last) return marks;
  return [...marks, seconds];
}

/** The marks worth keeping for a recording of `seconds`: none unless at least one ayah was stepped. */
export function finalMarks(marks: AyahMarks, seconds: number): AyahMarks {
  const kept = marks.filter((m) => m <= seconds);
  return kept.length > 1 ? kept : [];
}

/** Index of the ayah (within the unit) being recited at `position` seconds, or null without marks. */
export function ayahAt(marks: AyahMarks, position: number): number | null {
  if (marks.length === 0) return null;
  let index = 0;
  for (let i = 1; i < marks.length; i++) {
    if (marks[i] <= position) index = i;
    else break;
  }
  return index;
}

/** Second to seek to for the unit's `ayah`, or null when that ayah has no mark. */
export function markOf(marks: AyahMarks, ayah: number): number | null {
  return marks[ayah] ?? null;
}

export function encodeMarks(marks: AyahMarks): string | null {
  return marks.length > 0 ? JSON.stringify(marks) : null;
}

/** Reads the stored column; anything that is not an ascending list of seconds starting at 0 counts as none. */
export function decodeMarks(text: string | null): AyahMarks {
  if (text === null) return [];
  try {
    const value: unknown = JSON.parse(text);
    if (
      Array.isArray(value) &&
      value[0] === 0 &&
      value.every(
        (m, i) => typeof m === "number" && Number.isFinite(m) && (i === 0 || m >= value[i - 1]),
      )
    ) {
      return value as number[];
    }
  } catch {
    // A damaged value only loses the highlighting.
  }
  return [];
}
