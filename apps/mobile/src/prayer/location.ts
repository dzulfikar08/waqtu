import * as Location from "expo-location";
import type { SQLiteDatabase } from "expo-sqlite";

import { getSetting, setSettings } from "@/db/settings";

import type { City } from "./cities";
import { PRAYER_KEYS } from "./config";

export type LocationPermission = "granted" | "denied" | "undetermined";

/** How the stored place was chosen. Only a GPS place is refreshed automatically. */
const SOURCE_KEY = "locationSource";
/** A cached fix younger than this is reused instead of asking the GPS again. */
const FRESH_MS = 12 * 60 * 60 * 1000;

export async function getLocationPermission(): Promise<LocationPermission> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status;
}

export async function requestLocationPermission(): Promise<LocationPermission> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status !== "undetermined") return current.status;
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status;
}

function deviceZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export type LocationResult = "ok" | "denied" | "unavailable";

/**
 * Stores the phone's position (and its time zone) as the prayer location. Nothing is geocoded or sent anywhere: platform reverse geocoding calls Google/Apple, so a GPS place has no name. With `ask` it shows the
 * permission prompt when still open. Coarse accuracy is plenty for prayer times.
 */
export async function saveCurrentLocation(
  db: SQLiteDatabase,
  { ask }: { ask: boolean },
): Promise<LocationResult> {
  const permission = ask ? await requestLocationPermission() : await getLocationPermission();
  if (permission !== "granted") return "denied";
  try {
    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: FRESH_MS })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    const { latitude, longitude } = position.coords;
    await setSettings(db, {
      [PRAYER_KEYS.lat]: String(latitude),
      [PRAYER_KEYS.lon]: String(longitude),
      [PRAYER_KEYS.tz]: deviceZone(),
      [PRAYER_KEYS.locationName]: "",
      [PRAYER_KEYS.locationAt]: String(Date.now()),
      [SOURCE_KEY]: "gps",
    });
    return "ok";
  } catch {
    return "unavailable";
  }
}

export async function saveCity(db: SQLiteDatabase, city: City): Promise<void> {
  await setSettings(db, {
    [PRAYER_KEYS.lat]: String(city.latitude),
    [PRAYER_KEYS.lon]: String(city.longitude),
    [PRAYER_KEYS.tz]: city.timeZone,
    [PRAYER_KEYS.locationName]: city.name,
    [PRAYER_KEYS.locationAt]: String(Date.now()),
    [SOURCE_KEY]: "manual",
  });
}

/** Quietly re-reads the GPS when the saved position is a GPS one and older than 12 hours. */
export async function refreshLocationIfStale(db: SQLiteDatabase): Promise<void> {
  if ((await getSetting(db, SOURCE_KEY)) !== "gps") return;
  const at = Number(await getSetting(db, PRAYER_KEYS.locationAt));
  if (Number.isFinite(at) && Date.now() - at < FRESH_MS) return;
  await saveCurrentLocation(db, { ask: false });
}
