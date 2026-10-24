import type { Gender, Language } from "./constants";
import { badRequest, HttpError } from "./http";
import type { ProfileInput } from "./validate";

export interface Profile {
  handle: string;
  gender: Gender;
  language: Language;
  tzOffsetHours: number;
  summaryOptIn: boolean;
  suspended: boolean;
}

interface ProfileRow {
  handle: string;
  gender: Gender;
  language: Language;
  tz_offset_hours: number;
  summary_opt_in: number;
  suspended_at: number | null;
}

const toProfile = (r: ProfileRow): Profile => ({
  handle: r.handle,
  gender: r.gender,
  language: r.language,
  tzOffsetHours: r.tz_offset_hours,
  summaryOptIn: r.summary_opt_in === 1,
  suspended: r.suspended_at !== null,
});

export async function getProfile(db: D1Database, userId: string): Promise<Profile | null> {
  const row = await db
    .prepare(
      `SELECT handle, gender, language, tz_offset_hours, summary_opt_in, suspended_at
       FROM circle_profile WHERE user_id = ?1`,
    )
    .bind(userId)
    .first<ProfileRow>();
  return row ? toProfile(row) : null;
}

/** The profile every circle action needs: it exists (so gender is known) and is not suspended. */
export async function requireProfile(db: D1Database, userId: string): Promise<Profile> {
  const profile = await getProfile(db, userId);
  if (!profile) throw new HttpError(409, "profile_required");
  if (profile.suspended) throw new HttpError(403, "suspended");
  return profile;
}

const isUnique = (e: unknown) => e instanceof Error && /UNIQUE constraint failed/i.test(e.message);

/**
 * Creates the profile (gender required) or updates it. Gender is chosen once: sending a different
 * one later is refused, so nobody can hop between gender-separated circles.
 */
export async function saveProfile(
  db: D1Database,
  userId: string,
  input: ProfileInput,
  now: number,
): Promise<Profile> {
  const existing = await getProfile(db, userId);
  try {
    if (!existing) {
      if (!input.gender) throw badRequest("gender is required to join circles");
      await db
        .prepare(
          `INSERT INTO circle_profile
             (user_id, handle, gender, language, tz_offset_hours, summary_opt_in, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)`,
        )
        .bind(
          userId,
          input.handle,
          input.gender,
          input.language,
          input.tzOffsetHours,
          input.summaryOptIn ? 1 : 0,
          now,
        )
        .run();
    } else {
      if (input.gender && input.gender !== existing.gender) {
        throw new HttpError(409, "gender_locked");
      }
      await db
        .prepare(
          `UPDATE circle_profile SET handle = ?2, language = ?3, tz_offset_hours = ?4,
             summary_opt_in = ?5, updated_at = ?6 WHERE user_id = ?1`,
        )
        .bind(
          userId,
          input.handle,
          input.language,
          input.tzOffsetHours,
          (input.summaryOptIn ?? existing.summaryOptIn) ? 1 : 0,
          now,
        )
        .run();
    }
  } catch (e) {
    if (isUnique(e) && String((e as Error).message).includes("handle")) {
      throw new HttpError(409, "handle_taken");
    }
    throw e;
  }
  const saved = await getProfile(db, userId);
  if (!saved) throw new Error("profile vanished after save");
  return saved;
}
