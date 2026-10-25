// Compares the Apple apps' SharedPrayerCalculator output (apps/apple/parity -> swift.json) with @waqtu/core for the same cities/year.
// Usage: bun parity/compare.ts <swift.json> <year> [toleranceMinutes=1]
import { calculatePrayerTimes, type MethodId, type PrayerName } from "../src/index";
import cities from "./cities.json";

const [swiftPath, yearArg, tolArg] = process.argv.slice(2);
if (!swiftPath || !yearArg) throw new Error("usage: compare.ts <swift.json> <year> [tol]");
const year = Number(yearArg);
const tolMs = Number(tolArg ?? 1) * 60_000;

type Day = { date: string; error?: boolean } & Partial<
  Record<Exclude<PrayerName, "imsak">, number>
>;
const swift = (await Bun.file(swiftPath).json()) as Record<string, Record<string, Day[]>>;

const names = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"] as const;
const methods: Array<[string, MethodId]> = [
  ["mwl", "mwl"],
  ["kemenag", "kemenag"],
];

let compared = 0;
let worst = 0;
const failures: string[] = [];
for (const city of cities) {
  for (const [swiftId, method] of methods) {
    const days = swift[city.id]?.[swiftId];
    if (!days || days.length !== 365)
      failures.push(`${city.id}/${swiftId}: missing or not 365 days`);
    for (const day of days ?? []) {
      const [y, month, d] = day.date.split("-").map(Number);
      if (y !== year) failures.push(`${city.id}/${day.date}: unexpected year`);
      if (day.error) {
        failures.push(`${city.id}/${swiftId}/${day.date}: Swift returned nil`);
        continue;
      }
      const ts = calculatePrayerTimes({
        latitude: city.latitude,
        longitude: city.longitude,
        date: { year: y, month, day: d },
        timeZone: city.timeZone,
        method,
      });
      for (const n of names) {
        const instant = ts.times[n];
        if (!instant) {
          failures.push(`${city.id}/${swiftId}/${day.date}/${n}: ts undefined`);
          continue;
        }
        const diff = Math.abs(instant.getTime() - (day[n] as number) * 1000);
        compared++;
        worst = Math.max(worst, diff);
        if (diff > tolMs) {
          failures.push(
            `${city.id}/${swiftId}/${day.date}/${n}: ts=${instant.toISOString()} swift=${new Date((day[n] as number) * 1000).toISOString()}`,
          );
        }
      }
    }
  }
}
console.log(
  `compared ${compared} instants, worst diff ${worst / 60_000} min, ${failures.length} failures`,
);
if (failures.length) {
  console.log(failures.slice(0, 50).join("\n"));
  process.exit(1);
}
