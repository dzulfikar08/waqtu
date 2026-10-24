import {
  ayahWords,
  juzRange,
  pageOfIndex,
  pageRange,
  surahRange,
  TOTAL_JUZ,
  TOTAL_PAGES,
  TOTAL_SURAHS,
  type IndexRange,
} from "./quran";

/** A civil day as `YYYY-MM-DD`, the key mutabaah entries use. */
export type IsoDay = string;

const MS_DAY = 86_400_000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function dayMs(day: IsoDay): number {
  const m = ISO_DAY.exec(day);
  if (!m) throw new RangeError(`Invalid day: ${day}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function isIsoDay(value: unknown): value is IsoDay {
  if (typeof value !== "string" || !ISO_DAY.test(value)) return false;
  return addIsoDays(value, 0) === value;
}

export function addIsoDays(day: IsoDay, days: number): IsoDay {
  const d = new Date(dayMs(day) + days * MS_DAY);
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Whole days from `from` to `to` (`to - from`). */
export function diffIsoDays(from: IsoDay, to: IsoDay): number {
  return Math.round((dayMs(to) - dayMs(from)) / MS_DAY);
}

// ---------------------------------------------------------------------------------------------
// Target and units

/** What to memorise: surahs `from..to`, juz `from..to`, or mushaf pages `from..to`. */
export interface HafalanTarget {
  kind: "surah" | "juz" | "pages";
  from: number;
  to: number;
}

const TARGET_MAX = { surah: TOTAL_SURAHS, juz: TOTAL_JUZ, pages: TOTAL_PAGES } as const;

export function isValidTarget(target: HafalanTarget): boolean {
  const max = TARGET_MAX[target.kind];
  return (
    max !== undefined &&
    Number.isInteger(target.from) &&
    Number.isInteger(target.to) &&
    target.from >= 1 &&
    target.to <= max &&
    target.from <= target.to
  );
}

/** Ayah indexes a target covers. Throws `RangeError` for an invalid target. */
export function resolveTarget(target: HafalanTarget): IndexRange {
  if (!isValidTarget(target)) {
    throw new RangeError(`Invalid ${target.kind} target ${target.from}..${target.to}`);
  }
  switch (target.kind) {
    case "surah":
      return { start: surahRange(target.from).start, end: surahRange(target.to).end };
    case "juz":
      return { start: juzRange(target.from).start, end: juzRange(target.to).end };
    case "pages":
      return { start: pageRange(target.from).start, end: pageRange(target.to).end };
  }
}

/** The unit of memorising and reviewing: about half a mushaf page, cut between ayahs. */
export interface HafalanUnit {
  /** Position in the plan, 0-based; also the order units are memorised in. */
  index: number;
  /** Global ayah indexes, inclusive. */
  start: number;
  end: number;
  /** Mushaf page (1..604) the unit lies on. */
  page: number;
  words: number;
}

/** A page part with at least this many words is cut in two. Smaller ones stay whole. */
export const SPLIT_MIN_WORDS = 40;

function unitOf(start: number, end: number, page: number): Omit<HafalanUnit, "index"> {
  let words = 0;
  for (let i = start; i <= end; i++) words += ayahWords(i);
  return { start, end, page, words };
}

/**
 * Cuts `range` into units: each mushaf page (clipped to the range) becomes one unit, or two
 * halves cut at the ayah boundary closest to half of the page's words. Page boundaries come
 * from Tanzil's metadata; the half-page cut is by word count since the metadata has no lines.
 */
export function buildUnits(range: IndexRange): HafalanUnit[] {
  const parts: Omit<HafalanUnit, "index">[] = [];
  for (let page = pageOfIndex(range.start); page <= pageOfIndex(range.end); page++) {
    const p = pageRange(page);
    const start = Math.max(p.start, range.start);
    const end = Math.min(p.end, range.end);
    if (end < start) continue;
    const whole = unitOf(start, end, page);
    if (end === start || whole.words < SPLIT_MIN_WORDS) {
      parts.push(whole);
      continue;
    }
    let best = start + 1;
    let bestGap = Infinity;
    let before = ayahWords(start);
    for (let k = start + 1; k <= end; k++) {
      const gap = Math.abs(before - whole.words / 2);
      if (gap < bestGap) {
        best = k;
        bestGap = gap;
      }
      before += ayahWords(k);
    }
    parts.push(unitOf(start, best - 1, page), unitOf(best, end, page));
  }
  return parts.map((u, index) => ({ index, ...u }));
}

// ---------------------------------------------------------------------------------------------
// Spaced repetition (SM-2 style)

export const INITIAL_EASE = 2.5;
export const MIN_EASE = 1.3;
/** Longest gap between reviews of one unit, so nothing leaves the rotation for good. */
export const MAX_INTERVAL_DAYS = 60;
/** A unit with at least this interval counts as mastered in the stats. */
export const MASTERED_INTERVAL_DAYS = 21;

/** What the scheduler knows about one unit. A unit without a stored state is new. */
export interface UnitState {
  unit: number;
  ease: number;
  /** Days between the last review and the next. */
  interval: number;
  /** Consecutive reviews graded 3 or better. */
  reps: number;
  due: IsoDay | null;
  learnedOn: IsoDay | null;
  lastOn: IsoDay | null;
  lastGrade: number | null;
}

export function newUnitState(unit: number): UnitState {
  return {
    unit,
    ease: INITIAL_EASE,
    interval: 0,
    reps: 0,
    due: null,
    learnedOn: null,
    lastOn: null,
    lastGrade: null,
  };
}

export const GRADES = [0, 1, 2, 3, 4, 5] as const;

/** One grade per unit per day; a second grade the same day would double-count the review. */
export function canGrade(state: UnitState, today: IsoDay): boolean {
  return state.lastOn !== today;
}

/**
 * Applies a self-grade (0 blank … 5 perfect) on `today`, like SM-2: below 3 the unit starts over
 * and is due tomorrow; otherwise the interval goes 1 day, 6 days, then grows by the ease. The
 * ease moves with every grade (SM-2 leaves it alone on a lapse; here a lapse lowers it too) and
 * the interval is capped at `MAX_INTERVAL_DAYS`. The first grade also marks the unit learned.
 */
export function gradeUnit(state: UnitState, grade: number, today: IsoDay): UnitState {
  if (!Number.isInteger(grade) || grade < 0 || grade > 5) {
    throw new RangeError(`Grade must be an integer in 0..5, got ${grade}`);
  }
  const miss = 5 - grade;
  const ease = Math.max(MIN_EASE, state.ease + 0.1 - miss * (0.08 + miss * 0.02));
  let interval: number;
  let reps: number;
  if (grade < 3) {
    interval = 1;
    reps = 0;
  } else {
    reps = state.reps + 1;
    if (state.reps === 0) interval = 1;
    else if (state.reps === 1) interval = 6;
    else interval = Math.max(state.interval + 1, Math.round(state.interval * state.ease));
  }
  interval = Math.min(interval, MAX_INTERVAL_DAYS);
  return {
    unit: state.unit,
    ease: Math.round(ease * 100) / 100,
    interval,
    reps,
    due: addIsoDays(today, interval),
    learnedOn: state.learnedOn ?? today,
    lastOn: today,
    lastGrade: grade,
  };
}

// ---------------------------------------------------------------------------------------------
// Plan and daily portion

export const DEFAULT_MAX_REVIEW_PER_DAY = 12;

export interface HafalanPlan {
  target: HafalanTarget;
  startDay: IsoDay;
  deadline: IsoDay;
  /** Most units asked for murojaah in one day; the rest wait for the next days. */
  maxReviewPerDay: number;
}

export type PlanProblem = "target" | "day" | "deadline" | "review";

/** Why a plan cannot be made, or null when it can. The deadline may be the start day itself. */
export function planProblem(plan: HafalanPlan): PlanProblem | null {
  if (!isValidTarget(plan.target)) return "target";
  if (!isIsoDay(plan.startDay) || !isIsoDay(plan.deadline)) return "day";
  if (plan.deadline < plan.startDay) return "deadline";
  if (!Number.isInteger(plan.maxReviewPerDay) || plan.maxReviewPerDay < 1) return "review";
  return null;
}

export interface DailyPortion {
  day: IsoDay;
  /** `upcoming` before the start day, `pastDeadline` after the deadline (everything left is due). */
  phase: "upcoming" | "active" | "pastDeadline";
  /** Days from `day` to the deadline, counting both ends (at least 1). */
  daysLeft: number;
  /** New units to learn today, including those already learned today. */
  newTarget: number;
  sabaq: { todo: number[]; done: number[] };
  murojaah: {
    todo: number[];
    /** Reviewed today. */
    done: number[];
    /** Of `todo`, those due before today. */
    overdue: number;
    /** Due but beyond today's cap, carried to the next days. */
    deferred: number;
  };
  /** Today's list is cleared and something was done. This is what the mutabaah entry records. */
  complete: boolean;
}

function stateMap(states: readonly UnitState[]): Map<number, UnitState> {
  return new Map(states.map((s) => [s.unit, s]));
}

/**
 * What to do on `today`. New units: what is left to learn (counting what was learned today)
 * divided over the days left, so missing a day raises tomorrow's portion and finishing early
 * lowers it, with no bookkeeping. Murojaah: units due today or earlier, most overdue and
 * weakest first, up to the plan's daily cap; what does not fit stays due and is shown first
 * on the next day.
 */
export function dailyPortion(
  plan: HafalanPlan,
  unitCount: number,
  states: readonly UnitState[],
  today: IsoDay,
): DailyPortion {
  const byUnit = stateMap(states);
  const learned = (u: number) => byUnit.get(u)?.learnedOn != null;
  const phase =
    today < plan.startDay ? "upcoming" : today > plan.deadline ? "pastDeadline" : "active";
  const from = phase === "upcoming" ? plan.startDay : today;
  const daysLeft = phase === "pastDeadline" ? 1 : diffIsoDays(from, plan.deadline) + 1;

  const sabaqDone: number[] = [];
  const unlearned: number[] = [];
  for (let u = 0; u < unitCount; u++) {
    const s = byUnit.get(u);
    if (s?.learnedOn === today) sabaqDone.push(u);
    else if (!learned(u)) unlearned.push(u);
  }
  const startOfDayRemaining = unlearned.length + sabaqDone.length;
  const newTarget = phase === "upcoming" ? 0 : Math.ceil(startOfDayRemaining / daysLeft);
  const sabaqTodo = unlearned.slice(0, Math.max(0, newTarget - sabaqDone.length));

  const reviewed: number[] = [];
  const due: UnitState[] = [];
  for (const s of states) {
    if (s.unit >= unitCount || s.learnedOn === null || s.due === null) continue;
    if (s.learnedOn === today) continue;
    if (s.lastOn === today) reviewed.push(s.unit);
    else if (phase !== "upcoming" && s.due <= today) due.push(s);
  }
  due.sort(
    (a, b) =>
      (a.due as string).localeCompare(b.due as string) || a.ease - b.ease || a.unit - b.unit,
  );
  const room = Math.max(0, plan.maxReviewPerDay - reviewed.length);
  const todo = due.slice(0, room);

  return {
    day: today,
    phase,
    daysLeft,
    newTarget,
    sabaq: { todo: sabaqTodo, done: sabaqDone },
    murojaah: {
      todo: todo.map((s) => s.unit),
      done: reviewed.sort((a, b) => a - b),
      overdue: todo.filter((s) => (s.due as string) < today).length,
      deferred: due.length - todo.length,
    },
    complete:
      phase !== "upcoming" &&
      sabaqTodo.length === 0 &&
      todo.length === 0 &&
      sabaqDone.length + reviewed.length > 0,
  };
}

export interface HafalanStats {
  total: number;
  learned: number;
  /** 0..100, whole percent of units learned. */
  percent: number;
  /** Learned units whose review interval reached `MASTERED_INTERVAL_DAYS`. */
  mastered: number;
  /** Learned but not yet mastered. */
  learning: number;
  /** Due today or earlier. */
  due: number;
  /** Due before today. */
  overdue: number;
  /** Units the straight-line schedule has learned by the start of today. */
  expected: number;
  /** Units behind (or ahead of) that schedule at the start of today. */
  behind: number;
  ahead: number;
  averageEase: number | null;
  /** Day the plan would finish at the pace so far; null before anything is learned. */
  etaDay: IsoDay | null;
}

export function planStats(
  plan: HafalanPlan,
  unitCount: number,
  states: readonly UnitState[],
  today: IsoDay,
): HafalanStats {
  const learnedStates = states.filter((s) => s.unit < unitCount && s.learnedOn !== null);
  const learned = learnedStates.length;
  const learnedToday = learnedStates.filter((s) => s.learnedOn === today).length;
  const mastered = learnedStates.filter((s) => s.interval >= MASTERED_INTERVAL_DAYS).length;
  const dueStates = learnedStates.filter((s) => s.due !== null && s.due <= today);
  const totalDays = diffIsoDays(plan.startDay, plan.deadline) + 1;
  const elapsed = Math.min(totalDays, Math.max(0, diffIsoDays(plan.startDay, today)));
  const expected = Math.floor((unitCount * elapsed) / totalDays);
  const atStartOfDay = learned - learnedToday;
  const remaining = unitCount - learned;
  let etaDay: IsoDay | null = null;
  if (remaining === 0) etaDay = learned > 0 ? today : null;
  else if (learned > 0 && today >= plan.startDay) {
    const active = diffIsoDays(plan.startDay, today) + 1;
    etaDay = addIsoDays(today, Math.ceil(remaining / (learned / active)));
  }
  return {
    total: unitCount,
    learned,
    percent: unitCount === 0 ? 0 : Math.floor((learned * 100) / unitCount),
    mastered,
    learning: learned - mastered,
    due: dueStates.length,
    overdue: dueStates.filter((s) => (s.due as string) < today).length,
    expected,
    behind: Math.max(0, expected - atStartOfDay),
    ahead: Math.max(0, atStartOfDay - expected),
    averageEase:
      learned === 0
        ? null
        : Math.round((learnedStates.reduce((sum, s) => sum + s.ease, 0) / learned) * 100) / 100,
    etaDay,
  };
}
