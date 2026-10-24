import { expect, test } from "bun:test";

import { isSyncedSettingKey } from "../src/mutabaah/syncKeys";

test("location never syncs", () => {
  for (const key of [
    "lat",
    "lon",
    "tz",
    "locationName",
    "locationAt",
    "locationSource",
    "locale",
  ]) {
    expect(isSyncedSettingKey(key)).toBe(false);
  }
});

test("preferences and checklist config sync", () => {
  for (const key of [
    "items",
    "streak",
    "method",
    "asr",
    "hijriOffset",
    "offset.fajr",
    "offset.isha",
  ]) {
    expect(isSyncedSettingKey(key)).toBe(true);
  }
});
