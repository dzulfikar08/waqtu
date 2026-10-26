/**
 * Adhkar, Al-Ma'tsurat and doa shipped in the app (content/adhkar, copied unmodified from the Mutabaah app's resources).
 * Each file is its own module, required on first use, so opening the app does not evaluate them. The parsers check the
 * shape and keep every Arabic string exactly as stored; nothing here translates. A text carries the language its
 * translation is in (`translationLang`); the screens show it as is and say so when it differs from the app's language.
 */

export type TextLang = "id" | "en";

/** One recited text: a whole dhikr, or one ayah of a passage. */
export interface ReaderLine {
  /** "Ayat 1" within a passage; null for a single text. */
  label: string | null;
  arabic: string;
  latin: string | null;
  translation: string | null;
}

/** One counted step of a session: a single text, or a passage of ayat recited together (`heading` names it). */
export interface ReaderItem {
  /** Stable within its session; progress is stored by it. */
  key: string;
  title: string | null;
  heading: { arabic: string; latin: string | null; translation: string | null } | null;
  lines: readonly ReaderLine[];
  repeat: number;
  reference: string | null;
}

export type ReaderTime = "pagi" | "petang";
export type MatsuratKind = "kubro" | "sughro";
export type SessionId = `matsurat-${MatsuratKind}-${ReaderTime}` | `dzikir-${ReaderTime}`;

export interface ReaderSession {
  id: SessionId;
  /** The title as stored in the file. */
  sourceTitle: string;
  translationLang: TextLang;
  items: readonly ReaderItem[];
}

export interface Dua {
  id: string;
  title: string;
  arabic: string;
  transliteration: string;
  translation: string;
  reference: string;
  notes: string | null;
}

export interface DuaCategory {
  id: string;
  name: string;
  duas: readonly Dua[];
}

export class ContentError extends Error {}

/** Most repetitions any text asks for in the bundled files is 100; anything far above that is a broken file. */
const MAX_REPEAT = 1000;

function record(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ContentError(`${where}: expected an object`);
  }
  return value as Record<string, unknown>;
}

function list(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ContentError(`${where}: expected a non-empty array`);
  }
  return value;
}

function text(value: unknown, where: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ContentError(`${where}: expected text`);
  }
  return value;
}

function optionalText(value: unknown, where: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new ContentError(`${where}: expected text`);
  return value.trim() === "" ? null : value;
}

function repeat(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > MAX_REPEAT) {
    throw new ContentError(`${where}: expected a repeat count from 1 to ${MAX_REPEAT}`);
  }
  return value;
}

/** An Al-Ma'tsurat file: `data` of `single` texts and `parent` passages whose ayat sit in their own `data`. */
export function parseMatsurat(raw: unknown, id: SessionId): ReaderSession {
  const file = record(raw, id);
  const items = list(file.data, `${id}.data`).map((entry, index): ReaderItem => {
    const where = `${id}.data[${index}]`;
    const item = record(entry, where);
    const title = text(item.title, `${where}.title`);
    const type = item.type;
    if (type === "parent") {
      const lines = list(item.data, `${where}.data`).map((verse, v): ReaderLine => {
        const at = `${where}.data[${v}]`;
        const line = record(verse, at);
        return {
          label: optionalText(line.title, `${at}.title`),
          arabic: text(line.arabic, `${at}.arabic`),
          latin: optionalText(line.latin, `${at}.latin`),
          translation: optionalText(line.translation, `${at}.translation`),
        };
      });
      return {
        key: String(index),
        title,
        heading: {
          arabic: text(item.arabic, `${where}.arabic`),
          latin: optionalText(item.latin, `${where}.latin`),
          translation: optionalText(item.translation, `${where}.translation`),
        },
        lines,
        repeat: repeat(item.repeat, `${where}.repeat`),
        reference: null,
      };
    }
    if (type !== "single") throw new ContentError(`${where}.type: expected single or parent`);
    return {
      key: String(index),
      title,
      heading: null,
      lines: [
        {
          label: null,
          arabic: text(item.arabic, `${where}.arabic`),
          latin: optionalText(item.latin, `${where}.latin`),
          translation: optionalText(item.translation, `${where}.translation`),
        },
      ],
      repeat: repeat(item.repeat, `${where}.repeat`),
      reference: null,
    };
  });
  return { id, sourceTitle: text(file.title, `${id}.title`), translationLang: "id", items };
}

/** A morning or evening dhikr file: `items` with their own id, order, repetitions and hadith reference. */
export function parseDhikr(raw: unknown, id: SessionId): ReaderSession {
  const file = record(raw, id);
  const seen = new Set<string>();
  const items = list(file.items, `${id}.items`)
    .map((entry, index) => {
      const where = `${id}.items[${index}]`;
      const item = record(entry, where);
      const key = text(item.id, `${where}.id`);
      if (seen.has(key)) throw new ContentError(`${where}.id: duplicate ${key}`);
      seen.add(key);
      const order = item.order;
      if (typeof order !== "number" || !Number.isFinite(order)) {
        throw new ContentError(`${where}.order: expected a number`);
      }
      const parsed: ReaderItem = {
        key,
        title: null,
        heading: null,
        lines: [
          {
            label: null,
            arabic: text(item.arabic, `${where}.arabic`),
            latin: optionalText(item.transliteration, `${where}.transliteration`),
            translation: optionalText(item.translation, `${where}.translation`),
          },
        ],
        repeat: repeat(item.repetitions, `${where}.repetitions`),
        reference: optionalText(item.reference, `${where}.reference`),
      };
      return { order, parsed };
    })
    .sort((a, b) => a.order - b.order)
    .map(({ parsed }) => parsed);
  return { id, sourceTitle: text(file.title, `${id}.title`), translationLang: "en", items };
}

/** duas.json: categories of duas, each with an id unique across the file. */
export function parseDuas(raw: unknown): DuaCategory[] {
  const file = record(raw, "duas");
  const seen = new Set<string>();
  return list(file.categories, "duas.categories").map((entry, c) => {
    const where = `duas.categories[${c}]`;
    const category = record(entry, where);
    return {
      id: text(category.id, `${where}.id`),
      name: text(category.name, `${where}.name`),
      duas: list(category.duas, `${where}.duas`).map((d, i): Dua => {
        const at = `${where}.duas[${i}]`;
        const dua = record(d, at);
        const id = text(dua.id, `${at}.id`);
        if (seen.has(id)) throw new ContentError(`${at}.id: duplicate ${id}`);
        seen.add(id);
        return {
          id,
          title: text(dua.title, `${at}.title`),
          arabic: text(dua.arabic, `${at}.arabic`),
          transliteration: text(dua.transliteration, `${at}.transliteration`),
          translation: text(dua.translation, `${at}.translation`),
          reference: text(dua.reference, `${at}.reference`),
          notes: optionalText(dua.notes, `${at}.notes`),
        };
      }),
    };
  });
}

/** Translations of the duas are in English. */
export const DUA_TRANSLATION_LANG: TextLang = "en";

const SOURCES: Record<SessionId, () => ReaderSession> = {
  "matsurat-kubro-pagi": () =>
    parseMatsurat(require("../../../../content/adhkar/kubro-pagi.json"), "matsurat-kubro-pagi"),
  "matsurat-kubro-petang": () =>
    parseMatsurat(require("../../../../content/adhkar/kubro-petang.json"), "matsurat-kubro-petang"),
  "matsurat-sughro-pagi": () =>
    parseMatsurat(require("../../../../content/adhkar/sugro-pagi.json"), "matsurat-sughro-pagi"),
  "matsurat-sughro-petang": () =>
    parseMatsurat(require("../../../../content/adhkar/sugro-petang.json"), "matsurat-sughro-petang"),
  "dzikir-pagi": () =>
    parseDhikr(require("../../../../content/adhkar/morning_dhikr.json"), "dzikir-pagi"),
  "dzikir-petang": () =>
    parseDhikr(require("../../../../content/adhkar/evening_dhikr.json"), "dzikir-petang"),
};

export const SESSION_IDS = Object.keys(SOURCES) as SessionId[];

const sessions = new Map<SessionId, ReaderSession>();

/** A reader session, parsed on first use and kept. */
export function loadSession(id: SessionId): ReaderSession {
  let session = sessions.get(id);
  if (!session) {
    session = SOURCES[id]();
    sessions.set(id, session);
  }
  return session;
}

export function matsuratSession(kind: MatsuratKind, time: ReaderTime): SessionId {
  return `matsurat-${kind}-${time}`;
}

export function dzikirSession(time: ReaderTime): SessionId {
  return `dzikir-${time}`;
}

let duas: DuaCategory[] | undefined;

export function loadDuas(): readonly DuaCategory[] {
  duas ??= parseDuas(require("../../../../content/adhkar/duas.json"));
  return duas;
}

export function findDua(id: string): { dua: Dua; category: DuaCategory } | null {
  for (const category of loadDuas()) {
    const dua = category.duas.find((d) => d.id === id);
    if (dua) return { dua, category };
  }
  return null;
}
