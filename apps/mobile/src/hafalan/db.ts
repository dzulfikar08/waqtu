import {
  buildUnits,
  canGrade,
  dailyPortion,
  gradeUnit,
  newUnitState,
  planProblem,
  resolveTarget,
  type HafalanPlan,
  type HafalanUnit,
  type IsoDay,
  type UnitState,
} from "@waqtu/core";
import type { SQLiteDatabase } from "expo-sqlite";

import { setEntry } from "../db/entries";
import { emitDataChanged } from "../db/events";

/** Mutabaah item key a cleared hafalan day is recorded under. */
export const MUROJAAH_ITEM_ID = "murojaah";

export const MIN_REVIEW_PER_DAY = 4;
export const MAX_REVIEW_PER_DAY = 40;

interface PlanRow {
  kind: "surah" | "juz" | "pages";
  from_n: number;
  to_n: number;
  start_day: string;
  deadline: string;
  max_review: number;
}

interface UnitRow {
  unit: number;
  ease: number;
  interval_days: number;
  reps: number;
  due: string | null;
  learned_on: string | null;
  last_on: string | null;
  last_grade: number | null;
}

export function planUnits(plan: HafalanPlan): HafalanUnit[] {
  return buildUnits(resolveTarget(plan.target));
}

export async function getPlan(db: SQLiteDatabase): Promise<HafalanPlan | null> {
  const row = await db.getFirstAsync<PlanRow>(
    "SELECT kind, from_n, to_n, start_day, deadline, max_review FROM hafalan_plan WHERE id = 1",
  );
  if (!row) return null;
  return {
    target: { kind: row.kind, from: row.from_n, to: row.to_n },
    startDay: row.start_day,
    deadline: row.deadline,
    maxReviewPerDay: row.max_review,
  };
}

/**
 * Replaces the plan. Progress and recordings belonged to the old plan's units, so they go too;
 * the names of the recording files to delete from disk are returned.
 */
export async function savePlan(db: SQLiteDatabase, plan: HafalanPlan): Promise<string[]> {
  if (planProblem(plan)) throw new RangeError(`Invalid hafalan plan: ${planProblem(plan)}`);
  let files: string[] = [];
  await db.withTransactionAsync(async () => {
    files = await clearPlanRows(db);
    await db.runAsync(
      `INSERT INTO hafalan_plan (id, kind, from_n, to_n, start_day, deadline, max_review, created_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
      plan.target.kind,
      plan.target.from,
      plan.target.to,
      plan.startDay,
      plan.deadline,
      plan.maxReviewPerDay,
      Date.now(),
    );
  });
  emitDataChanged();
  return files;
}

/** Deletes the plan with its progress and recordings; returns the recording files to remove from disk. */
export async function deletePlan(db: SQLiteDatabase): Promise<string[]> {
  let files: string[] = [];
  await db.withTransactionAsync(async () => {
    files = await clearPlanRows(db);
  });
  emitDataChanged();
  return files;
}

async function clearPlanRows(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ file: string }>("SELECT file FROM hafalan_recording");
  await db.runAsync("DELETE FROM hafalan_recording");
  await db.runAsync("DELETE FROM hafalan_unit");
  await db.runAsync("DELETE FROM hafalan_plan");
  return rows.map((r) => r.file);
}

/** Moves the deadline and/or the review cap of the existing plan; progress stays. */
export async function updatePlan(
  db: SQLiteDatabase,
  change: { deadline?: IsoDay; maxReviewPerDay?: number },
): Promise<void> {
  const plan = await getPlan(db);
  if (!plan) return;
  const next: HafalanPlan = {
    ...plan,
    deadline: change.deadline ?? plan.deadline,
    maxReviewPerDay: change.maxReviewPerDay ?? plan.maxReviewPerDay,
  };
  if (planProblem(next)) throw new RangeError(`Invalid hafalan plan: ${planProblem(next)}`);
  await db.runAsync(
    "UPDATE hafalan_plan SET deadline = ?, max_review = ? WHERE id = 1",
    next.deadline,
    next.maxReviewPerDay,
  );
  emitDataChanged();
}

export async function getStates(db: SQLiteDatabase): Promise<UnitState[]> {
  const rows = await db.getAllAsync<UnitRow>(
    "SELECT unit, ease, interval_days, reps, due, learned_on, last_on, last_grade FROM hafalan_unit ORDER BY unit",
  );
  return rows.map((r) => ({
    unit: r.unit,
    ease: r.ease,
    interval: r.interval_days,
    reps: r.reps,
    due: r.due,
    learnedOn: r.learned_on,
    lastOn: r.last_on,
    lastGrade: r.last_grade,
  }));
}

async function upsertState(db: SQLiteDatabase, s: UnitState): Promise<void> {
  await db.runAsync(
    `INSERT INTO hafalan_unit (unit, ease, interval_days, reps, due, learned_on, last_on, last_grade)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(unit) DO UPDATE SET ease = excluded.ease, interval_days = excluded.interval_days,
       reps = excluded.reps, due = excluded.due, learned_on = excluded.learned_on,
       last_on = excluded.last_on, last_grade = excluded.last_grade`,
    s.unit,
    s.ease,
    s.interval,
    s.reps,
    s.due,
    s.learnedOn,
    s.lastOn,
    s.lastGrade,
  );
}

export interface GradeResult {
  state: UnitState;
  /** Today's list is now cleared, so the `murojaah` mutabaah entry was written. */
  dayComplete: boolean;
}

/**
 * Applies a self-grade to a unit on `today` and, when that clears the day's list (new portion and
 * murojaah), records the `murojaah` mutabaah entry for `today`, queued for sync. Returns null
 * when there is no plan, the unit does not exist, or it was already graded today.
 */
export async function gradeUnitToday(
  db: SQLiteDatabase,
  unit: number,
  grade: number,
  today: IsoDay,
): Promise<GradeResult | null> {
  let result = null as GradeResult | null;
  await db.withTransactionAsync(async () => {
    const plan = await getPlan(db);
    if (!plan) return;
    const count = planUnits(plan).length;
    if (!Number.isInteger(unit) || unit < 0 || unit >= count) return;
    const states = await getStates(db);
    const current = states.find((s) => s.unit === unit) ?? newUnitState(unit);
    if (!canGrade(current, today)) return;
    const state = gradeUnit(current, grade, today);
    await upsertState(db, state);
    const after = states.filter((s) => s.unit !== unit).concat(state);
    const dayComplete = dailyPortion(plan, count, after, today).complete;
    if (dayComplete) await setEntry(db, today, MUROJAAH_ITEM_ID, 1);
    result = { state, dayComplete };
  });
  emitDataChanged();
  return result;
}

export interface StoredRecording {
  file: string;
  seconds: number;
}

export async function getRecordings(db: SQLiteDatabase): Promise<Map<number, StoredRecording>> {
  const rows = await db.getAllAsync<{ unit: number; file: string; seconds: number }>(
    "SELECT unit, file, seconds FROM hafalan_recording",
  );
  return new Map(rows.map((r) => [r.unit, { file: r.file, seconds: r.seconds }]));
}

/** Keeps `file` as the unit's recording; returns the file it replaced (to delete from disk), if any. */
export async function saveRecording(
  db: SQLiteDatabase,
  unit: number,
  file: string,
  seconds: number,
): Promise<string | null> {
  let replaced = null as string | null;
  await db.withTransactionAsync(async () => {
    const old = await db.getFirstAsync<{ file: string }>(
      "SELECT file FROM hafalan_recording WHERE unit = ?",
      unit,
    );
    replaced = old && old.file !== file ? old.file : null;
    await db.runAsync(
      `INSERT INTO hafalan_recording (unit, file, seconds, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(unit) DO UPDATE SET file = excluded.file, seconds = excluded.seconds, created_at = excluded.created_at`,
      unit,
      file,
      seconds,
      Date.now(),
    );
  });
  emitDataChanged();
  return replaced;
}

/** Forgets a unit's recording; returns its file name to delete from disk. */
export async function deleteRecording(db: SQLiteDatabase, unit: number): Promise<string | null> {
  const row = await db.getFirstAsync<{ file: string }>(
    "SELECT file FROM hafalan_recording WHERE unit = ?",
    unit,
  );
  if (!row) return null;
  await db.runAsync("DELETE FROM hafalan_recording WHERE unit = ?", unit);
  emitDataChanged();
  return row.file;
}
