import type { SQLiteDatabase } from "expo-sqlite";

import { isLocalePref, resolveLocale, deviceLanguages, type LocalePref } from "@/i18n/locale";
import { applyLocale } from "@/i18n/core";
import { emitDataChanged } from "./events";

const LOCALE_KEY = "locale";

export async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    key,
  );
  return row?.value ?? null;
}

/** One device-local setting; null deletes the key. Never uploaded. */
export async function setSetting(
  db: SQLiteDatabase,
  key: string,
  value: string | null,
): Promise<void> {
  if (value === null) await db.runAsync("DELETE FROM settings WHERE key = ?", key);
  else await setSettings(db, { [key]: value });
  if (value === null) emitDataChanged();
}

/** Device-local settings (location, time zone, ...) written together. Never uploaded. */
export async function setSettings(
  db: SQLiteDatabase,
  values: Readonly<Record<string, string>>,
): Promise<void> {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const [key, value] of Object.entries(values)) {
      await db.runAsync(
        "INSERT INTO settings (key, value, updated_at, dirty) VALUES (?, ?, ?, 0) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, dirty = 0",
        key,
        value,
        now,
      );
    }
  });
  emitDataChanged();
}

/** A setting that follows the account: stamped now (never older than what is stored) and queued for the next sync. */
export async function setSyncedSetting(
  db: SQLiteDatabase,
  key: string,
  value: string,
): Promise<void> {
  await db.runAsync(
    "INSERT INTO settings (key, value, updated_at, dirty) VALUES (?, ?, ?, 1) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = MAX(excluded.updated_at, settings.updated_at + 1), dirty = 1",
    key,
    value,
    Date.now(),
  );
  emitDataChanged();
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
