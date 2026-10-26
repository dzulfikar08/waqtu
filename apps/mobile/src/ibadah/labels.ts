import type { Dua, DuaCategory } from "./content";

/**
 * Indonesian names for the doa categories and doa titles in duas.json, whose own names are English. These are list
 * labels ("Before Eating"), not the doa: the Arabic, transliteration and translation are always shown as stored.
 * An id missing here falls back to the file's English name.
 */
const CATEGORIES_ID: Readonly<Record<string, string>> = {
  "daily-supplications": "Doa sehari-hari",
  "protection-duas": "Perlindungan & keselamatan",
  "gratitude-duas": "Syukur & pujian",
  "forgiveness-duas": "Memohon ampunan",
  "travel-duas": "Perjalanan",
};

const TITLES_ID: Readonly<Record<string, string>> = {
  "dua-before-eating": "Sebelum makan",
  "dua-after-eating": "Sesudah makan",
  "dua-entering-home": "Masuk rumah",
  "dua-leaving-home": "Keluar rumah",
  "dua-entering-masjid": "Masuk masjid",
  "dua-leaving-masjid": "Keluar masjid",
  "dua-protection": "Memohon perlindungan",
  "dua-evil-eye": "Perlindungan dari 'ain",
  "dua-gratitude": "Syukur",
  "dua-new-blessing": "Saat menerima nikmat",
  "dua-istighfar": "Istighfar",
  "dua-sayyidul-istighfar": "Sayyidul istighfar",
  "dua-travel": "Dalam perjalanan",
};

export function categoryName(category: DuaCategory, language: string): string {
  return language === "id" ? (CATEGORIES_ID[category.id] ?? category.name) : category.name;
}

export function duaTitle(dua: Dua, language: string): string {
  return language === "id" ? (TITLES_ID[dua.id] ?? dua.title) : dua.title;
}

/** Lower case without Arabic harakat or Latin accents, so "dua'", "Du'ā" and a bare Arabic word all match. */
export function foldForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g, "")
    .replace(/['`ʿʾ‘’]/g, "")
    .toLowerCase();
}

/** Duas matching every word of `query` in any of their texts; all of them for an empty query. */
export function searchDuas(
  categories: readonly DuaCategory[],
  query: string,
  language: string,
): { category: DuaCategory; duas: Dua[] }[] {
  const words = foldForSearch(query).split(/\s+/).filter(Boolean);
  return categories
    .map((category) => ({
      category,
      duas: category.duas.filter((dua) => {
        if (words.length === 0) return true;
        const haystack = foldForSearch(
          [
            duaTitle(dua, language),
            dua.title,
            categoryName(category, language),
            dua.transliteration,
            dua.translation,
            dua.arabic,
            dua.reference,
          ].join(" "),
        );
        return words.every((word) => haystack.includes(word));
      }),
    }))
    .filter((group) => group.duas.length > 0);
}

/** Stored favourites (a JSON array of dua ids) → a set; anything malformed is an empty set. */
export function parseFavourites(raw: string | null | undefined): Set<string> {
  if (!raw) return new Set();
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return new Set();
    return new Set(data.filter((id): id is string => typeof id === "string" && id.length <= 64));
  } catch {
    return new Set();
  }
}

export function toggleFavourite(favourites: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(favourites);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function serializeFavourites(favourites: ReadonlySet<string>): string {
  return JSON.stringify([...favourites].sort());
}
