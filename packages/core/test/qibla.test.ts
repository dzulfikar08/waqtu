import { describe, expect, test } from "bun:test";
import { Coordinates, Qibla } from "adhan";

import {
  KAABA,
  distanceToKaabaKm,
  isAligned,
  normalizeDegrees,
  qiblaBearing,
  turnTo,
} from "../src/index";

/**
 * Expected bearings are the great-circle initial bearing to the Kaaba (21.4225°N 39.8262°E), computed independently
 * with Python's math module: atan2(sin Δλ, cos φ·tan φK − sin φ·cos Δλ).
 */
const CITIES = [
  { name: "Jakarta", lat: -6.2088, lon: 106.8456, bearing: 295.1517 },
  { name: "London", lat: 51.5074, lon: -0.1278, bearing: 118.9872 },
  { name: "New York", lat: 40.7128, lon: -74.006, bearing: 58.4817 },
  { name: "Sydney", lat: -33.8688, lon: 151.2093, bearing: 277.4996 },
  { name: "Tokyo", lat: 35.6762, lon: 139.6503, bearing: 292.9987 },
  { name: "Madinah", lat: 24.4672, lon: 39.6111, bearing: 176.2353 },
];

/** Haversine distance, mean Earth radius 6371.0088 km, computed the same way in Python. */
const DISTANCES = [
  { name: "Jakarta", lat: -6.2088, lon: 106.8456, km: 7920.1 },
  { name: "London", lat: 51.5074, lon: -0.1278, km: 4793.8 },
  { name: "New York", lat: 40.7128, lon: -74.006, km: 10306.3 },
];

describe("qibla bearing", () => {
  test.each(CITIES)("$name", ({ lat, lon, bearing }) => {
    expect(qiblaBearing(lat, lon)).toBeCloseTo(bearing, 3);
  });

  test("the usual rounded figures: Jakarta ≈ 295°, London ≈ 119°, NYC ≈ 58°", () => {
    expect(Math.round(qiblaBearing(-6.2088, 106.8456))).toBe(295);
    expect(Math.round(qiblaBearing(51.5074, -0.1278))).toBe(119);
    expect(Math.round(qiblaBearing(40.7128, -74.006))).toBe(58);
  });

  // The Swift app (Mutabaah) used Adhan-Swift's `Qibla`; adhan-js is the same algorithm with the Kaaba at
  // 21.4225241, 39.8261818. Away from Makkah the two Kaaba points differ by far less than a hundredth of a degree.
  test.each(CITIES)("agrees with Adhan's Qibla: $name", ({ lat, lon }) => {
    expect(Math.abs(turnTo(qiblaBearing(lat, lon), Qibla(new Coordinates(lat, lon))))).toBeLessThan(
      0.01,
    );
  });

  test("always in [0, 360)", () => {
    for (let lat = -80; lat <= 80; lat += 20) {
      for (let lon = -180; lon <= 180; lon += 30) {
        if (lat === KAABA.latitude && lon === KAABA.longitude) continue;
        const b = qiblaBearing(lat, lon);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThan(360);
      }
    }
  });

  test("due south from north of the Kaaba on its meridian, due north from south of it", () => {
    expect(qiblaBearing(30, KAABA.longitude)).toBeCloseTo(180, 6);
    expect(qiblaBearing(10, KAABA.longitude)).toBeCloseTo(0, 6);
  });
});

describe("distance to the Kaaba", () => {
  test.each(DISTANCES)("$name", ({ lat, lon, km }) => {
    expect(distanceToKaabaKm(lat, lon)).toBeCloseTo(km, 0);
  });

  test("zero at the Kaaba", () => {
    expect(distanceToKaabaKm(KAABA.latitude, KAABA.longitude)).toBeCloseTo(0, 6);
  });
});

describe("turning and alignment", () => {
  test("normalizeDegrees folds into [0, 360)", () => {
    expect(normalizeDegrees(-10)).toBe(350);
    expect(normalizeDegrees(360)).toBe(0);
    expect(normalizeDegrees(725)).toBe(5);
  });

  test("turnTo takes the short way round", () => {
    expect(turnTo(350, 10)).toBe(20);
    expect(turnTo(10, 350)).toBe(-20);
    expect(turnTo(0, 180)).toBe(180);
    expect(turnTo(90, 90)).toBe(0);
  });

  test("aligned within ±3° by default, across north", () => {
    expect(isAligned(295, 295.15)).toBe(true);
    expect(isAligned(298, 295.15)).toBe(true);
    expect(isAligned(299, 295.15)).toBe(false);
    expect(isAligned(358.5, 1)).toBe(true);
    expect(isAligned(355, 1)).toBe(false);
    expect(isAligned(100, 110, 10)).toBe(true);
  });
});
