import type { SQLiteDatabase } from "expo-sqlite";

import { isLocalePref, resolveLocale, deviceLanguages, type LocalePref } from "@/i18n/locale";
import { applyLocale } from "@/i18n/core";

const LOCALE_KEY = "locale";

async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    key,
  );
  return row?.value ?? null;
}

/** The stored Settings choice; `auto` when none. */
export async function getLocalePref(db: SQLiteDatabase): Promise<LocalePref> {
  const value = await getSetting(db, LOCALE_KEY);
  return isLocalePref(value) ? value : "auto";
}

/** Persists the language choice (`auto` clears it) and applies it at once. */
export async function setLocalePref(db: SQLiteDatabase, pref: LocalePref): Promise<void> {
  if (pref === "auto") await db.runAsync("DELETE FROM settings WHERE key = ?", LOCALE_KEY);
  else
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      LOCALE_KEY,
      pref,
    );
  await applyLocale(resolveLocale({ pref, device: deviceLanguages() }));
}

/** Applies the stored language (or the phone's). Runs once the database is open, before the first screen. */
export async function initLocale(db: SQLiteDatabase): Promise<void> {
  const pref = await getLocalePref(db);
  await applyLocale(resolveLocale({ pref, device: deviceLanguages() }));
}
