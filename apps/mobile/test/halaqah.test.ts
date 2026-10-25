import { describe, expect, test } from "bun:test";

import programJson from "../../../content/halaqah/ramadhan-1448/program.json";
import { bundledProgram } from "../src/halaqah/bundled";
import {
  completeDay,
  deleteVoiceReflection,
  getProgress,
  getReflection,
  getVoiceReflection,
  HALAQAH_ITEM_ID,
  saveReflection,
  saveVoiceReflection,
  uncompleteDay,
} from "../src/halaqah/db";
import { embedHtml, embedUrl, isEmbedNavigation } from "../src/halaqah/embed";
import { HALAQAH_VOICE_MIGRATION } from "../src/halaqah/migrations";
import { formatNudgeTime, parseNudgeTime, planNudges } from "../src/halaqah/nudge";
import {
  halaqahRef,
  isReleasable,
  parseHalaqahRef,
  parseProgram,
  ProgramError,
  YOUTUBE_ID,
} from "../src/halaqah/program";
import { nextUncompletedDay, programPosition } from "../src/halaqah/schedule";
import { getEntriesBetween } from "../src/db/entries";
import { MIGRATIONS } from "../src/db/migrations";
import { migratedDb } from "./helpers/sqlite";

const clone = () => structuredClone(programJson) as Record<string, any>;

describe("bundled program", () => {
  const program = parseProgram(programJson);

  test("30 days, numbered 1..30 once each", () => {
    expect(program.totalDays).toBe(30);
    expect(program.days).toHaveLength(30);
    expect(program.days.map((d) => d.day)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(new Set(program.days.map((d) => d.day)).size).toBe(30);
  });

  test("every video id is a YouTube id and no video repeats", () => {
    const ids = program.days.map((d) => d.video.youtubeId);
    for (const id of ids) expect(YOUTUBE_ID.test(id)).toBe(true);
    expect(new Set(ids).size).toBe(30);
  });

  test("every day carries summary, reflection prompt, amalan and bilingual titles", () => {
    for (const d of program.days) {
      expect(d.summary.length).toBeGreaterThan(0);
      expect(d.reflectionPrompt.length).toBeGreaterThan(0);
      expect(d.amalan?.length).toBeGreaterThan(0);
      expect(d.title.id.length).toBeGreaterThan(0);
      expect(d.title.en.length).toBeGreaterThan(0);
    }
  });

  test("the bundled loader returns the same parsed program", () => {
    expect(bundledProgram()).toEqual(program);
  });
});

describe("parseProgram rejects bad content", () => {
  const fails = (mutate: (json: Record<string, any>) => void, pattern: RegExp) => {
    const json = clone();
    mutate(json);
    expect(() => parseProgram(json)).toThrow(ProgramError);
    try {
      parseProgram(json);
    } catch (error) {
      expect((error as ProgramError).message).toMatch(pattern);
    }
  };

  test("not an object", () => {
    expect(() => parseProgram(null)).toThrow(ProgramError);
    expect(() => parseProgram([])).toThrow(ProgramError);
  });

  test("a missing day", () => fails((j) => j.days.splice(4, 1), /expected 30 entries/));

  test("a duplicate day number", () =>
    fails((j) => (j.days[5].day = 5), /expected day 6, found day 5/));

  test("a malformed youtube id", () =>
    fails((j) => (j.days[0].video.youtube_id = "short"), /not an 11-character YouTube id/));

  test("a repeated video", () =>
    fails((j) => (j.days[1].video.youtube_id = j.days[0].video.youtube_id), /duplicate video/));

  test("a day outside its phase", () =>
    fails((j) => (j.days[0].phase = "quran-tilawah"), /outside phase/));

  test("an unknown phase", () => fails((j) => (j.days[0].phase = "nope"), /unknown phase/));

  test("phases that leave a gap", () =>
    fails((j) => (j.program.phases[1].days = [9, 14]), /start at day 8/));

  test("an empty summary", () => fails((j) => (j.days[2].summary_id = " "), /summary_id/));

  test("a non-youtube channel url", () =>
    fails((j) => (j.days[0].video.channel_url = "https://example.com/x"), /channel_url/));

  test("reports every problem at once", () => {
    const json = clone();
    json.days[0].video.youtube_id = "x";
    json.days[1].amalan_id = "";
    try {
      parseProgram(json);
      throw new Error("expected failure");
    } catch (error) {
      expect((error as ProgramError).problems.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("accepts a madhhab note of null", () => {
    const json = clone();
    json.days[0].madhhab_note_id = null;
    expect(parseProgram(json).days[0].madhhabNote).toBeNull();
  });

  test("amalan is optional: null or absent reads as null, an empty one is rejected", () => {
    const json = clone();
    json.days[0].amalan_id = null;
    delete json.days[1].amalan_id;
    const program = parseProgram(json);
    expect(program.days[0].amalan).toBeNull();
    expect(program.days[1].amalan).toBeNull();
    expect(program.days[2].amalan).toBe(json.days[2].amalan_id);
    fails((j) => (j.days[3].amalan_id = " "), /amalan_id/);
  });
});

describe("halaqah reference on circle posts", () => {
  // services/api/src/circles/validate.ts REF_RE
  const SERVER_REF = /^[A-Za-z0-9._:-]{1,64}$/;

  test("program and day round-trip and fit the server's pattern", () => {
    const ref = halaqahRef("ramadhan-1448", 12);
    expect(ref).toBe("ramadhan-1448:12");
    expect(SERVER_REF.test(ref)).toBe(true);
    expect(parseHalaqahRef(ref)).toEqual({ programId: "ramadhan-1448", day: 12 });
  });

  test("other references read as null", () => {
    for (const ref of ["2027-02-08", "ramadhan-1448", "ramadhan-1448:0", "x:1:2", "A:1"]) {
      expect(parseHalaqahRef(ref)).toBeNull();
    }
  });
});

describe("programPosition", () => {
  // Under the app's calendar (Umm al-Qura, offset 0): Ramadhan 1447 = 2026-02-18..03-19 (30 days),
  // Ramadhan 1448 = 2027-02-08..03-08 (29 days), Ramadhan 1449 starts 2028-01-28.
  const at = (
    year: number,
    month: number,
    day: number,
    offset = 0,
    totalDays = 30,
    hijriYear = 1448,
  ) => programPosition({ year, month, day }, offset, { hijriYear, totalDays });

  test("before Ramadhan counts down the days", () => {
    expect(at(2027, 2, 5)).toEqual({ kind: "before", daysUntil: 3 });
    expect(at(2027, 2, 7)).toEqual({ kind: "before", daysUntil: 1 });
    expect(at(2026, 10, 25)).toEqual({ kind: "before", daysUntil: 106 });
  });

  test("the first fasting day is day 1, then 2, 3 ...", () => {
    expect(at(2027, 2, 8)).toEqual({ kind: "during", day: 1 });
    expect(at(2027, 2, 9)).toEqual({ kind: "during", day: 2 });
    expect(at(2027, 2, 17)).toEqual({ kind: "during", day: 10 });
  });

  test("day 30 is the last day of a 30-day Ramadhan; the next day is after", () => {
    expect(at(2026, 3, 19, 0, 30, 1447)).toEqual({ kind: "during", day: 30 });
    expect(at(2026, 3, 20, 0, 30, 1447)).toEqual({ kind: "after" });
  });

  test("a 29-day Ramadhan ends on day 29", () => {
    expect(at(2027, 3, 8)).toEqual({ kind: "during", day: 29 });
    expect(at(2027, 3, 9)).toEqual({ kind: "after" });
  });

  test("the user's hijri offset moves the day", () => {
    expect(at(2027, 2, 8, 0)).toEqual({ kind: "during", day: 1 });
    expect(at(2027, 2, 8, -1)).toEqual({ kind: "before", daysUntil: 1 });
    expect(at(2027, 2, 8, 1)).toEqual({ kind: "during", day: 2 });
  });

  test("a program shorter than Ramadhan clamps to its last day", () => {
    expect(at(2027, 2, 19, 0, 10)).toEqual({ kind: "during", day: 10 });
  });

  test("Ramadhan 1449 is not the 1448 program's Ramadhan: after, never during or a countdown", () => {
    expect(at(2028, 1, 20)).toEqual({ kind: "after" });
    expect(at(2028, 1, 28)).toEqual({ kind: "after" });
    expect(at(2028, 2, 10)).toEqual({ kind: "after" });
    expect(at(2027, 4, 1)).toEqual({ kind: "after" });
  });

  test("a 1449 program reads the same dates as before (countdown) and then during", () => {
    expect(at(2028, 1, 25, 0, 30, 1449)).toEqual({ kind: "before", daysUntil: 3 });
    expect(at(2028, 1, 28, 0, 30, 1449)).toEqual({ kind: "during", day: 1 });
  });

  test("an earlier year's Ramadhan is before, with no countdown", () => {
    expect(at(2026, 2, 18)).toEqual({ kind: "before", daysUntil: null });
    expect(at(2026, 3, 1)).toEqual({ kind: "before", daysUntil: null });
  });
});

describe("isReleasable", () => {
  test("only approved content reaches production; anything shows in development", () => {
    expect(isReleasable({ status: "approved" }, false)).toBe(true);
    expect(isReleasable({ status: "draft-pending-owner-approval" }, false)).toBe(false);
    expect(isReleasable({ status: "draft-pending-owner-approval" }, true)).toBe(true);
    expect(isReleasable({ status: "Approved" }, false)).toBe(false);
  });

  test("the bundled program is gated by its status", () => {
    expect(isReleasable(bundledProgram(), false)).toBe(bundledProgram().status === "approved");
  });
});

describe("nextUncompletedDay", () => {
  test("first gap, then null when finished", () => {
    expect(nextUncompletedDay(new Set(), 30)).toBe(1);
    expect(nextUncompletedDay(new Set([1, 2, 4]), 30)).toBe(3);
    expect(nextUncompletedDay(new Set(Array.from({ length: 30 }, (_, i) => i + 1)), 30)).toBeNull();
  });
});

describe("embed", () => {
  test("privacy-enhanced domain, no autoplay", () => {
    const url = embedUrl("m97SDRxy8GM");
    expect(url.startsWith("https://www.youtube-nocookie.com/embed/m97SDRxy8GM?")).toBe(true);
    expect(url).toContain("autoplay=0");
    expect(url).not.toContain("autoplay=1");
    expect(embedHtml("m97SDRxy8GM").baseUrl).toBe("https://www.youtube-nocookie.com");
  });

  test("rejects an invalid id", () => {
    expect(() => embedUrl('x"><script>')).toThrow(RangeError);
  });

  test("isEmbedNavigation allows the initial base-URL load (iOS) and the embed itself", () => {
    const { baseUrl } = embedHtml("m97SDRxy8GM");
    expect(isEmbedNavigation(baseUrl)).toBe(true);
    expect(isEmbedNavigation(`${baseUrl}/`)).toBe(true);
    expect(isEmbedNavigation("about:blank")).toBe(true);
    expect(isEmbedNavigation(embedUrl("m97SDRxy8GM"))).toBe(true);
  });

  test("isEmbedNavigation blocks other top-frame navigations", () => {
    expect(isEmbedNavigation("https://www.youtube.com/watch?v=m97SDRxy8GM")).toBe(false);
    expect(isEmbedNavigation("https://www.youtube-nocookie.com.evil.example/embed/x")).toBe(false);
    expect(isEmbedNavigation("https://www.youtube-nocookie.com/watch?v=m97SDRxy8GM")).toBe(false);
    expect(isEmbedNavigation("https://evil.example/")).toBe(false);
    expect(isEmbedNavigation("intent://x#Intent;end")).toBe(false);
  });

  test("isEmbedNavigation does not restrict sub-frame loads", () => {
    expect(isEmbedNavigation("https://www.youtube.com/s/player/base.html", false)).toBe(true);
  });
});

describe("completion and reflections (real migrations, SQLite)", () => {
  const PROGRAM = "ramadhan-1448";
  const entries = async (
    db: Awaited<ReturnType<typeof migratedDb>>["db"],
    from: string,
    to: string,
  ) => getEntriesBetween(db, from, to);

  test("the halaqah voice migration is the latest step", () => {
    expect(MIGRATIONS.at(-1)).toBe(HALAQAH_VOICE_MIGRATION);
  });

  test("Selesai records progress and a dirty `halaqah` mutabaah entry on today's date", async () => {
    const { db, raw } = await migratedDb();
    await completeDay(db, PROGRAM, 3, "2027-02-12");
    expect([...(await getProgress(db, PROGRAM))]).toEqual([[3, "2027-02-12"]]);
    expect(await entries(db, "2027-02-12", "2027-02-12")).toEqual([
      { date: "2027-02-12", itemId: HALAQAH_ITEM_ID, value: 1 },
    ]);
    const row = raw.query("SELECT dirty FROM entries WHERE item_id = 'halaqah'").get() as {
      dirty: number;
    };
    expect(row.dirty).toBe(1);
  });

  test("catch-up: a past day finished today writes today's entry, and repeating keeps the first date", async () => {
    const { db } = await migratedDb();
    await completeDay(db, PROGRAM, 1, "2027-02-14");
    await completeDay(db, PROGRAM, 1, "2027-02-20");
    expect((await getProgress(db, PROGRAM)).get(1)).toBe("2027-02-14");
    expect(await entries(db, "2027-02-20", "2027-02-20")).toEqual([]);
  });

  test("undo clears the entry unless another session finished that day", async () => {
    const { db } = await migratedDb();
    await completeDay(db, PROGRAM, 1, "2027-02-14");
    await completeDay(db, PROGRAM, 2, "2027-02-14");
    await uncompleteDay(db, PROGRAM, 1);
    expect((await entries(db, "2027-02-14", "2027-02-14"))[0].value).toBe(1);
    await uncompleteDay(db, PROGRAM, 2);
    expect((await entries(db, "2027-02-14", "2027-02-14"))[0].value).toBe(0);
    expect((await getProgress(db, PROGRAM)).size).toBe(0);
  });

  test("reflections are saved per day, trimmed, replaced, and deleted when emptied", async () => {
    const { db } = await migratedDb();
    expect(await getReflection(db, PROGRAM, 4)).toBe("");
    await saveReflection(db, PROGRAM, 4, "  niatku ikhlas  ");
    expect(await getReflection(db, PROGRAM, 4)).toBe("niatku ikhlas");
    await saveReflection(db, PROGRAM, 4, "berubah");
    expect(await getReflection(db, PROGRAM, 4)).toBe("berubah");
    expect(await getReflection(db, PROGRAM, 5)).toBe("");
    await saveReflection(db, PROGRAM, 4, "   ");
    expect(await getReflection(db, PROGRAM, 4)).toBe("");
  });

  test("reflections never enter the sync tables", async () => {
    const { db, raw } = await migratedDb();
    await saveReflection(db, PROGRAM, 1, "pribadi");
    await completeDay(db, PROGRAM, 1, "2027-02-10");
    const rows = raw.query("SELECT item_id FROM entries").all();
    expect(rows).toEqual([{ item_id: "halaqah" }]);
    expect(JSON.stringify(raw.query("SELECT * FROM settings").all())).not.toContain("pribadi");
  });
});

describe("voice reflections (real migrations, SQLite)", () => {
  const PROGRAM = "ramadhan-1448";

  test("one recording per day: saved, replaced (old file returned), deleted", async () => {
    const { db } = await migratedDb();
    expect(await getVoiceReflection(db, PROGRAM, 2)).toBeNull();
    expect(await saveVoiceReflection(db, PROGRAM, 2, { file: "a.m4a", seconds: 12.4 })).toBeNull();
    expect(await getVoiceReflection(db, PROGRAM, 2)).toEqual({ file: "a.m4a", seconds: 12 });
    expect(await saveVoiceReflection(db, PROGRAM, 2, { file: "b.m4a", seconds: 30 })).toBe("a.m4a");
    expect(await getVoiceReflection(db, PROGRAM, 2)).toEqual({ file: "b.m4a", seconds: 30 });
    expect(await getVoiceReflection(db, PROGRAM, 3)).toBeNull();
    expect(await deleteVoiceReflection(db, PROGRAM, 2)).toBe("b.m4a");
    expect(await getVoiceReflection(db, PROGRAM, 2)).toBeNull();
    expect(await deleteVoiceReflection(db, PROGRAM, 2)).toBeNull();
  });

  test("voice reflections never enter the sync tables", async () => {
    const { db, raw } = await migratedDb();
    await saveVoiceReflection(db, PROGRAM, 1, { file: "pribadi.m4a", seconds: 5 });
    expect(raw.query("SELECT * FROM entries").all()).toEqual([]);
    expect(JSON.stringify(raw.query("SELECT * FROM settings").all())).not.toContain("pribadi");
  });
});

describe("daily nudge", () => {
  // Ramadhan 1448 = 2027-02-08..03-08 (29 days) under offset 0; WIB is UTC+7 all year.
  const program = { hijriYear: 1448, totalDays: 30 };
  const plan = (
    now: string,
    done: [number, string][],
    days = 3,
    zone = "Asia/Jakarta",
    p = program,
  ) =>
    planNudges({
      now: new Date(now),
      zone,
      time: { hour: 16, minute: 0 },
      hijriOffset: 0,
      program: p,
      done: new Map(done),
      days,
    }).map((n) => ({ at: n.at.toISOString(), kind: n.kind, day: n.day }));

  test("time setting: HH:MM only", () => {
    expect(parseNudgeTime("05:30")).toEqual({ hour: 5, minute: 30 });
    expect(parseNudgeTime("23:59")).toEqual({ hour: 23, minute: 59 });
    for (const raw of [null, "", "24:00", "7:00", "07:60", "x"])
      expect(parseNudgeTime(raw)).toBeNull();
    expect(formatNudgeTime({ hour: 7, minute: 5 })).toBe("07:05");
  });

  test("during Ramadhan: one nudge a day at the chosen local time, for that day's talk", () => {
    expect(plan("2027-02-08T03:00:00Z", [])).toEqual([
      { at: "2027-02-08T09:00:00.000Z", kind: "today", day: 1 },
      { at: "2027-02-09T09:00:00.000Z", kind: "today", day: 2 },
      { at: "2027-02-10T09:00:00.000Z", kind: "today", day: 3 },
    ]);
  });

  test("a time already past today starts tomorrow", () => {
    expect(plan("2027-02-08T10:00:00Z", [], 2)).toEqual([
      { at: "2027-02-09T09:00:00.000Z", kind: "today", day: 2 },
    ]);
  });

  test("no nudge on a day a session was already finished", () => {
    expect(plan("2027-02-08T03:00:00Z", [[1, "2027-02-08"]], 2)).toEqual([
      { at: "2027-02-09T09:00:00.000Z", kind: "today", day: 2 },
    ]);
  });

  test("a day read ahead points to the first open talk, not to anything missed", () => {
    expect(plan("2027-02-08T03:00:00Z", [[2, "2027-02-01"]], 2)).toEqual([
      { at: "2027-02-08T09:00:00.000Z", kind: "today", day: 1 },
      { at: "2027-02-09T09:00:00.000Z", kind: "continue", day: 1 },
    ]);
  });

  test("before Ramadhan only for someone who started early", () => {
    expect(plan("2026-10-25T03:00:00Z", [])).toEqual([]);
    expect(plan("2026-10-25T03:00:00Z", [[1, "2026-10-20"]], 1)).toEqual([
      { at: "2026-10-25T09:00:00.000Z", kind: "continue", day: 2 },
    ]);
  });

  test("stops when the program's Ramadhan ends and once every day is done", () => {
    expect(plan("2027-03-07T03:00:00Z", [], 5)).toEqual([
      { at: "2027-03-07T09:00:00.000Z", kind: "today", day: 28 },
      { at: "2027-03-08T09:00:00.000Z", kind: "today", day: 29 },
    ]);
    const all = Array.from({ length: 30 }, (_, i): [number, string] => [i + 1, "2027-02-01"]);
    expect(plan("2027-02-10T03:00:00Z", all)).toEqual([]);
  });

  test("follows the zone's clock across a DST change", () => {
    const later = { hijriYear: 1449, totalDays: 30 };
    expect(plan("2027-03-27T12:00:00Z", [[1, "2027-01-01"]], 2, "Europe/London", later)).toEqual([
      { at: "2027-03-27T16:00:00.000Z", kind: "continue", day: 2 },
      { at: "2027-03-28T15:00:00.000Z", kind: "continue", day: 2 },
    ]);
  });
});
