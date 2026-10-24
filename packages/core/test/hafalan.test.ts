import { describe, expect, test } from "bun:test";

import {
  addIsoDays,
  ayahIndex,
  buildUnits,
  canGrade,
  dailyPortion,
  diffIsoDays,
  gradeUnit,
  INITIAL_EASE,
  isIsoDay,
  isValidTarget,
  MAX_INTERVAL_DAYS,
  MIN_EASE,
  newUnitState,
  pageRange,
  planProblem,
  planStats,
  refOfIndex,
  resolveTarget,
  SPLIT_MIN_WORDS,
  TOTAL_AYAHS,
  type HafalanPlan,
  type HafalanTarget,
  type UnitState,
} from "../src/index";

const juz30: HafalanTarget = { kind: "juz", from: 30, to: 30 };
const unitsOf = (t: HafalanTarget) => buildUnits(resolveTarget(t));

const basePlan = (over: Partial<HafalanPlan> = {}): HafalanPlan => ({
  target: juz30,
  startDay: "2027-03-01",
  deadline: "2027-03-30",
  maxReviewPerDay: 12,
  ...over,
});

describe("days", () => {
  test("add and diff cross months and leap days", () => {
    expect(addIsoDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addIsoDays("2027-12-31", 1)).toBe("2028-01-01");
    expect(addIsoDays("2027-03-01", -1)).toBe("2027-02-28");
    expect(diffIsoDays("2027-03-01", "2027-03-30")).toBe(29);
    expect(diffIsoDays("2027-03-30", "2027-03-01")).toBe(-29);
  });
  test("isIsoDay rejects impossible dates", () => {
    expect(isIsoDay("2027-02-28")).toBe(true);
    expect(isIsoDay("2027-02-30")).toBe(false);
    expect(isIsoDay("27-2-1")).toBe(false);
    expect(isIsoDay(20270301)).toBe(false);
  });
});

describe("targets and units", () => {
  test("resolve surah, juz and page ranges to ayah indexes", () => {
    expect(resolveTarget({ kind: "surah", from: 1, to: 1 })).toEqual({ start: 0, end: 6 });
    expect(resolveTarget({ kind: "surah", from: 112, to: 114 })).toEqual({
      start: 6221,
      end: 6235,
    });
    expect(refOfIndex(resolveTarget(juz30).start)).toEqual({ surah: 78, ayah: 1 });
    expect(resolveTarget(juz30).end).toBe(TOTAL_AYAHS - 1);
    expect(resolveTarget({ kind: "pages", from: 604, to: 604 })).toEqual(pageRange(604));
  });

  test("invalid targets are rejected", () => {
    for (const t of [
      { kind: "surah", from: 0, to: 1 },
      { kind: "surah", from: 2, to: 1 },
      { kind: "surah", from: 1, to: 115 },
      { kind: "juz", from: 1, to: 31 },
      { kind: "pages", from: 1, to: 605 },
      { kind: "pages", from: 1.5, to: 2 },
    ] as const) {
      expect(isValidTarget(t)).toBe(false);
      expect(() => resolveTarget(t)).toThrow(RangeError);
    }
  });

  test("units tile the range exactly, in order, with sequential indexes", () => {
    for (const t of [
      juz30,
      { kind: "surah", from: 2, to: 2 },
      { kind: "pages", from: 1, to: 604 },
      { kind: "surah", from: 78, to: 114 },
    ] as HafalanTarget[]) {
      const range = resolveTarget(t);
      const units = buildUnits(range);
      let next = range.start;
      for (const [i, u] of units.entries()) {
        expect(u.index).toBe(i);
        expect(u.start).toBe(next);
        expect(u.end).toBeGreaterThanOrEqual(u.start);
        next = u.end + 1;
      }
      expect(next).toBe(range.end + 1);
    }
  });

  test("a page becomes two halves cut between ayahs; units never span pages", () => {
    const units = unitsOf({ kind: "pages", from: 3, to: 3 });
    expect(units).toHaveLength(2);
    expect(units.every((u) => u.page === 3)).toBe(true);
    expect(units[0].end + 1).toBe(units[1].start);
    expect(Math.abs(units[0].words - units[1].words)).toBeLessThan(units[0].words + units[1].words);
    const all = unitsOf({ kind: "pages", from: 1, to: 604 });
    expect(all.length).toBeGreaterThan(604);
    expect(all.length).toBeLessThanOrEqual(1208);
    for (const u of all)
      expect(pageRange(u.page).start <= u.start && u.end <= pageRange(u.page).end).toBe(true);
  });

  test("small pieces stay whole and single-ayah pages are not cut", () => {
    expect(unitsOf({ kind: "surah", from: 112, to: 112 })).toHaveLength(1);
    expect(unitsOf({ kind: "surah", from: 1, to: 1 })).toHaveLength(1);
    const small = unitsOf({ kind: "surah", from: 105, to: 106 });
    for (const u of small) expect(u.words < SPLIT_MIN_WORDS || u.end > u.start).toBe(true);
    const [first] = unitsOf({ kind: "surah", from: 2, to: 2 });
    expect(refOfIndex(first.start)).toEqual({ surah: 2, ayah: 1 });
  });

  test("a range inside one page is clipped to the range", () => {
    const start = ayahIndex(2, 1);
    const units = buildUnits({ start, end: start + 1 });
    expect(units[0].start).toBe(start);
    expect(units.at(-1)?.end).toBe(start + 1);
  });
});

describe("grading (SM-2 style)", () => {
  const today = "2027-03-01";

  test("a first good grade learns the unit and schedules tomorrow, then 6 days, then by ease", () => {
    let s = gradeUnit(newUnitState(0), 4, today);
    expect(s).toMatchObject({
      learnedOn: today,
      lastOn: today,
      due: "2027-03-02",
      interval: 1,
      reps: 1,
      lastGrade: 4,
    });
    s = gradeUnit(s, 4, "2027-03-02");
    expect([s.interval, s.reps, s.due]).toEqual([6, 2, "2027-03-08"]);
    const ease = s.ease;
    s = gradeUnit(s, 4, "2027-03-08");
    expect(s.interval).toBe(Math.round(6 * ease));
    expect(s.reps).toBe(3);
    expect(s.learnedOn).toBe(today);
  });

  test("ease follows the SM-2 formula and never drops below the floor", () => {
    expect(gradeUnit(newUnitState(0), 5, today).ease).toBe(2.6);
    expect(gradeUnit(newUnitState(0), 4, today).ease).toBe(INITIAL_EASE);
    expect(gradeUnit(newUnitState(0), 3, today).ease).toBe(2.36);
    let s = newUnitState(0);
    for (let i = 0; i < 20; i++) s = gradeUnit(s, 0, today);
    expect(s.ease).toBe(MIN_EASE);
  });

  test("a grade below 3 starts the unit over and is due tomorrow", () => {
    let s = gradeUnit(
      gradeUnit(gradeUnit(newUnitState(0), 5, today), 5, "2027-03-02"),
      5,
      "2027-03-08",
    );
    expect(s.interval).toBeGreaterThan(6);
    s = gradeUnit(s, 2, "2027-03-20");
    expect([s.interval, s.reps, s.due]).toEqual([1, 0, "2027-03-21"]);
    s = gradeUnit(s, 3, "2027-03-21");
    expect([s.interval, s.reps]).toEqual([1, 1]);
  });

  test("a weak first grade still marks the unit learned (it is weak, not unlearned)", () => {
    const s = gradeUnit(newUnitState(3), 1, today);
    expect(s.learnedOn).toBe(today);
    expect(s.due).toBe("2027-03-02");
  });

  test("intervals are capped", () => {
    let s = newUnitState(0);
    let day = today;
    for (let i = 0; i < 12; i++) {
      s = gradeUnit(s, 5, day);
      day = addIsoDays(day, s.interval);
    }
    expect(s.interval).toBe(MAX_INTERVAL_DAYS);
  });

  test("invalid grades throw and a unit can be graded once a day", () => {
    for (const g of [-1, 6, 2.5, Number.NaN])
      expect(() => gradeUnit(newUnitState(0), g, today)).toThrow(RangeError);
    const s = gradeUnit(newUnitState(0), 4, today);
    expect(canGrade(s, today)).toBe(false);
    expect(canGrade(s, "2027-03-02")).toBe(true);
    expect(canGrade(newUnitState(0), today)).toBe(true);
  });
});

describe("daily portion", () => {
  const target: HafalanTarget = { kind: "juz", from: 28, to: 30 };
  const n = unitsOf(target).length;
  const plan = (over: Partial<HafalanPlan> = {}) => basePlan({ target, ...over });

  test("spreads the target over the days left", () => {
    const p = dailyPortion(plan(), n, [], "2027-03-01");
    expect(p.phase).toBe("active");
    expect(p.daysLeft).toBe(30);
    expect(p.newTarget).toBe(Math.ceil(n / 30));
    expect(p.sabaq.todo).toEqual(Array.from({ length: p.newTarget }, (_, i) => i));
    expect(p.murojaah.todo).toEqual([]);
    expect(p.complete).toBe(false);
  });

  test("learning units today keeps today's target steady and marks them done", () => {
    const states = [0, 1].map((u) => gradeUnit(newUnitState(u), 4, "2027-03-01"));
    const p = dailyPortion(plan(), n, states, "2027-03-01");
    expect(p.newTarget).toBe(Math.ceil(n / 30));
    expect(p.sabaq.done).toEqual([0, 1]);
    expect(p.sabaq.todo[0]).toBe(2);
    expect(p.sabaq.todo.length + 2).toBe(p.newTarget);
  });

  test("missed days rebalance: the remainder is spread over fewer days", () => {
    const day1 = dailyPortion(plan(), n, [], "2027-03-01");
    const day11 = dailyPortion(plan(), n, [], "2027-03-11");
    expect(day11.daysLeft).toBe(20);
    expect(day11.newTarget).toBe(Math.ceil(n / 20));
    expect(day11.newTarget).toBeGreaterThan(day1.newTarget);
  });

  test("working ahead lowers later portions", () => {
    const learned = Array.from({ length: 30 }, (_, u) =>
      gradeUnit(newUnitState(u), 4, "2027-03-01"),
    );
    const next = dailyPortion(plan(), n, learned, "2027-03-02");
    expect(next.newTarget).toBe(Math.ceil((n - 30) / 29));
    expect(next.newTarget).toBeLessThan(dailyPortion(plan(), n, [], "2027-03-02").newTarget);
  });

  test("before the start day nothing is due; after the deadline everything left is", () => {
    const before = dailyPortion(plan(), n, [], "2027-02-27");
    expect(before.phase).toBe("upcoming");
    expect(before.sabaq.todo).toEqual([]);
    expect(before.complete).toBe(false);
    const after = dailyPortion(plan(), n, [], "2027-04-02");
    expect(after.phase).toBe("pastDeadline");
    expect(after.daysLeft).toBe(1);
    expect(after.sabaq.todo).toHaveLength(n);
  });

  test("the last day takes everything that remains", () => {
    const states = Array.from({ length: n - 3 }, (_, u) =>
      gradeUnit(newUnitState(u), 4, "2027-03-01"),
    );
    const p = dailyPortion(plan(), n, states, "2027-03-30");
    expect(p.daysLeft).toBe(1);
    expect(p.sabaq.todo).toEqual([n - 3, n - 2, n - 1]);
  });

  test("murojaah lists due units, most overdue then weakest first, within the daily cap", () => {
    const base = (unit: number, due: string, ease: number): UnitState => ({
      ...newUnitState(unit),
      ease,
      interval: 6,
      reps: 2,
      due,
      learnedOn: "2027-02-01",
      lastOn: "2027-02-10",
      lastGrade: 4,
    });
    const states = [
      base(0, "2027-03-05", 2.5),
      base(1, "2027-03-03", 2.5),
      base(2, "2027-03-03", 1.8),
      base(3, "2027-03-09", 2.5),
      base(4, "2027-03-05", 2.5),
    ];
    const p = dailyPortion(plan({ maxReviewPerDay: 3 }), n, states, "2027-03-05");
    expect(p.murojaah.todo).toEqual([2, 1, 0]);
    expect(p.murojaah.overdue).toBe(2);
    expect(p.murojaah.deferred).toBe(1);
    const next = dailyPortion(plan({ maxReviewPerDay: 3 }), n, states, "2027-03-06");
    expect(next.murojaah.todo).toEqual([2, 1, 0]);
    expect(next.murojaah.deferred).toBe(1);
  });

  test("reviewing a unit moves it out of the list and counts toward the cap", () => {
    const due: UnitState = {
      ...newUnitState(0),
      interval: 1,
      reps: 1,
      due: "2027-03-02",
      learnedOn: "2027-03-01",
      lastOn: "2027-03-01",
      lastGrade: 4,
    };
    const day2 = dailyPortion(plan(), n, [due], "2027-03-02");
    expect(day2.murojaah.todo).toEqual([0]);
    const graded = gradeUnit(due, 5, "2027-03-02");
    const after = dailyPortion(plan({ maxReviewPerDay: 1 }), n, [graded], "2027-03-02");
    expect(after.murojaah).toMatchObject({ todo: [], done: [0], overdue: 0, deferred: 0 });
  });

  test("units learned today are not asked for murojaah the same day", () => {
    const p = dailyPortion(plan(), n, [gradeUnit(newUnitState(0), 4, "2027-03-01")], "2027-03-01");
    expect(p.murojaah.todo).toEqual([]);
    expect(p.murojaah.done).toEqual([]);
  });

  test("complete once today's lists are cleared and something was done", () => {
    const target = Math.ceil(n / 30);
    const states = Array.from({ length: target }, (_, u) =>
      gradeUnit(newUnitState(u), 4, "2027-03-01"),
    );
    const done = dailyPortion(plan(), n, states, "2027-03-01");
    expect(done.sabaq.todo).toEqual([]);
    expect(done.complete).toBe(true);
    const partial = dailyPortion(plan(), n, states.slice(0, target - 1), "2027-03-01");
    expect(partial.complete).toBe(false);
    // Nothing due and nothing done today: not complete.
    const resting: UnitState = {
      ...newUnitState(0),
      interval: 20,
      reps: 4,
      due: "2027-04-01",
      learnedOn: "2027-02-01",
      lastOn: "2027-03-01",
      lastGrade: 5,
    };
    const idle = dailyPortion(
      plan({ target: { kind: "surah", from: 112, to: 112 } }),
      1,
      [resting],
      "2027-03-02",
    );
    expect(idle).toMatchObject({ sabaq: { todo: [] }, murojaah: { todo: [] }, complete: false });
  });

  test("a finished plan keeps only murojaah", () => {
    const states = Array.from({ length: n }, (_, u) => gradeUnit(newUnitState(u), 4, "2027-03-10"));
    const p = dailyPortion(plan(), n, states, "2027-03-11");
    expect(p.sabaq.todo).toEqual([]);
    expect(p.murojaah.todo).toHaveLength(12);
    expect(p.murojaah.deferred).toBe(n - 12);
  });
});

describe("plan validation and stats", () => {
  const plan = basePlan;
  test("planProblem names what is wrong", () => {
    expect(planProblem(plan())).toBeNull();
    expect(planProblem(plan({ deadline: plan().startDay }))).toBeNull();
    expect(planProblem(plan({ target: { kind: "juz", from: 0, to: 1 } }))).toBe("target");
    expect(planProblem(plan({ startDay: "2027-13-01" }))).toBe("day");
    expect(planProblem(plan({ deadline: "2027-02-28" }))).toBe("deadline");
    expect(planProblem(plan({ maxReviewPerDay: 0 }))).toBe("review");
  });

  test("stats: progress, mastery, due, schedule position and ETA", () => {
    const units = unitsOf(juz30).length;
    const states: UnitState[] = [];
    for (let u = 0; u < 20; u++) states.push(gradeUnit(newUnitState(u), 4, "2027-03-01"));
    states[0] = { ...states[0], interval: 30, due: "2027-03-31" };
    const stats = planStats(plan(), units, states, "2027-03-02");
    expect(stats.total).toBe(units);
    expect(stats.learned).toBe(20);
    expect(stats.percent).toBe(Math.floor((20 * 100) / units));
    expect(stats.mastered).toBe(1);
    expect(stats.learning).toBe(19);
    expect(stats.due).toBe(19);
    expect(stats.overdue).toBe(0);
    expect(stats.expected).toBe(Math.floor(units / 30));
    expect(stats.ahead).toBe(20 - stats.expected);
    expect(stats.behind).toBe(0);
    expect(stats.averageEase).toBe(INITIAL_EASE);
    expect(stats.etaDay).toBe(addIsoDays("2027-03-02", Math.ceil((units - 20) / (20 / 2))));
  });

  test("stats: behind schedule, overdue, and no ETA before anything is learned", () => {
    const units = unitsOf(juz30).length;
    const idle = planStats(plan(), units, [], "2027-03-16");
    expect(idle.learned).toBe(0);
    expect(idle.behind).toBe(Math.floor((units * 15) / 30));
    expect(idle.etaDay).toBeNull();
    expect(idle.averageEase).toBeNull();
    const lagging = planStats(
      plan(),
      units,
      [gradeUnit(newUnitState(0), 4, "2027-03-01")],
      "2027-03-16",
    );
    expect(lagging.overdue).toBe(1);
    expect(lagging.due).toBe(1);
  });

  test("stats: a finished plan's ETA is today", () => {
    const units = unitsOf(juz30).length;
    const states = Array.from({ length: units }, (_, u) =>
      gradeUnit(newUnitState(u), 4, "2027-03-05"),
    );
    const stats = planStats(plan(), units, states, "2027-03-05");
    expect(stats.percent).toBe(100);
    expect(stats.etaDay).toBe("2027-03-05");
  });
});
