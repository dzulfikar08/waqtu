/**
 * Halaqah program: one talk per day of Ramadhan. The shipped program is bundled JSON
 * (content/halaqah/<id>/program.json); `parseProgram` is the single entry point that turns any
 * JSON (bundled today, server-delivered later) into the typed shape the screens use. It is pure and
 * throws `ProgramError` listing every problem it finds, so a bad content edit fails in CI.
 */

export interface Bilingual {
  id: string;
  en: string;
}

export interface Phase {
  id: string;
  title: Bilingual;
  /** First and last program day of the phase, inclusive. */
  from: number;
  to: number;
}

export interface Video {
  /** 11-character YouTube video id; embedded only, never downloaded. */
  youtubeId: string;
  title: string;
  channelName: string;
  channelUrl: string;
  speaker: string;
  durationMin: number;
  language: string;
}

export interface ProgramDay {
  /** 1-based, equals the day of Ramadhan the session is meant for. */
  day: number;
  phase: string;
  themeId: string;
  title: Bilingual;
  topic: string;
  video: Video;
  summary: string;
  reflectionPrompt: string;
  amalan: string;
  sources: string[];
  /** Madhhab positions on a disputed fiqh point; null on days without one. */
  madhhabNote: string | null;
}

export interface Program {
  id: string;
  title: Bilingual;
  hijriYear: number;
  totalDays: number;
  /** Editorial status as written in the content file, e.g. "draft-pending-owner-approval". */
  status: string;
  phases: Phase[];
  /** Ordered by `day`, exactly `totalDays` long. */
  days: ProgramDay[];
}

export class ProgramError extends Error {
  readonly problems: readonly string[];
  constructor(problems: readonly string[]) {
    super(`Invalid halaqah program:\n- ${problems.join("\n- ")}`);
    this.name = "ProgramError";
    this.problems = problems;
  }
}

export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_CHANNEL = /^https:\/\/www\.youtube\.com\/@[\w.-]+$/;
const PROGRAM_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

type Obj = Record<string, unknown>;

class Reader {
  readonly problems: string[] = [];

  obj(value: unknown, path: string): Obj | null {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Obj;
    }
    this.problems.push(`${path}: expected an object`);
    return null;
  }

  str(parent: Obj, key: string, path: string): string {
    const value = parent[key];
    if (typeof value === "string" && value.trim() !== "") return value;
    this.problems.push(`${path}.${key}: expected a non-empty string`);
    return "";
  }

  int(parent: Obj, key: string, path: string, min: number, max: number): number {
    const value = parent[key];
    if (typeof value === "number" && Number.isInteger(value) && value >= min && value <= max) {
      return value;
    }
    this.problems.push(`${path}.${key}: expected an integer in ${min}..${max}`);
    return min;
  }

  arr(parent: Obj, key: string, path: string): unknown[] {
    const value = parent[key];
    if (Array.isArray(value)) return value;
    this.problems.push(`${path}.${key}: expected an array`);
    return [];
  }
}

function readPhases(r: Reader, program: Obj, totalDays: number): Phase[] {
  const phases: Phase[] = [];
  const seen = new Set<string>();
  let expectedFrom = 1;
  r.arr(program, "phases", "program").forEach((raw, i) => {
    const path = `program.phases[${i}]`;
    const p = r.obj(raw, path);
    if (!p) return;
    const id = r.str(p, "id", path);
    if (seen.has(id)) r.problems.push(`${path}.id: duplicate phase "${id}"`);
    seen.add(id);
    const range = r.arr(p, "days", path);
    const [from, to] = range;
    const rangeOk =
      range.length === 2 &&
      Number.isInteger(from) &&
      Number.isInteger(to) &&
      (from as number) >= 1 &&
      (to as number) >= (from as number) &&
      (to as number) <= totalDays;
    if (!rangeOk) {
      r.problems.push(`${path}.days: expected [from, to] inside 1..${totalDays}`);
      return;
    }
    if (from !== expectedFrom) {
      r.problems.push(`${path}.days: expected to start at day ${expectedFrom}, got ${from}`);
    }
    expectedFrom = (to as number) + 1;
    phases.push({
      id,
      title: { id: r.str(p, "title_id", path), en: r.str(p, "title_en", path) },
      from: from as number,
      to: to as number,
    });
  });
  if (phases.length > 0 && expectedFrom !== totalDays + 1) {
    r.problems.push(`program.phases: must cover days 1..${totalDays} without gaps`);
  }
  return phases;
}

function readVideo(r: Reader, raw: unknown, path: string): Video {
  const v = r.obj(raw, path) ?? {};
  const youtubeId = r.str(v, "youtube_id", path);
  if (youtubeId && !YOUTUBE_ID.test(youtubeId)) {
    r.problems.push(`${path}.youtube_id: "${youtubeId}" is not an 11-character YouTube id`);
  }
  const channelUrl = r.str(v, "channel_url", path);
  if (channelUrl && !YOUTUBE_CHANNEL.test(channelUrl)) {
    r.problems.push(`${path}.channel_url: expected https://www.youtube.com/@handle`);
  }
  return {
    youtubeId,
    title: r.str(v, "verified_title", path),
    channelName: r.str(v, "channel_name", path),
    channelUrl,
    speaker: r.str(v, "speaker", path),
    durationMin: r.int(v, "duration_min", path, 1, 600),
    language: r.str(v, "language", path),
  };
}

function readDay(r: Reader, raw: unknown, index: number, phases: readonly Phase[]): ProgramDay {
  const path = `days[${index}]`;
  const d = r.obj(raw, path) ?? {};
  const day = r.int(d, "day", path, 1, 366);
  const phase = r.str(d, "phase", path);
  const owner = phases.find((p) => p.id === phase);
  if (phase && !owner) r.problems.push(`${path}.phase: unknown phase "${phase}"`);
  else if (owner && (day < owner.from || day > owner.to)) {
    r.problems.push(`${path}.day: ${day} is outside phase "${phase}" (${owner.from}-${owner.to})`);
  }
  const sources = r.arr(d, "sources", path);
  if (!sources.every((s) => typeof s === "string" && s.trim() !== "")) {
    r.problems.push(`${path}.sources: expected non-empty strings`);
  }
  const note = d["madhhab_note_id"];
  if (note !== null && (typeof note !== "string" || note.trim() === "")) {
    r.problems.push(`${path}.madhhab_note_id: expected a non-empty string or null`);
  }
  return {
    day,
    phase,
    themeId: r.str(d, "theme_id", path),
    title: { id: r.str(d, "title_id", path), en: r.str(d, "title_en", path) },
    topic: r.str(d, "topic", path),
    video: readVideo(r, d["video"], `${path}.video`),
    summary: r.str(d, "summary_id", path),
    reflectionPrompt: r.str(d, "reflection_prompt_id", path),
    amalan: r.str(d, "amalan_id", path),
    sources: sources.filter((s): s is string => typeof s === "string"),
    madhhabNote: typeof note === "string" ? note : null,
  };
}

/** Validates program JSON and returns the typed program. Throws `ProgramError` when anything is off. */
export function parseProgram(json: unknown): Program {
  const r = new Reader();
  const root = r.obj(json, "$");
  if (!root) throw new ProgramError(r.problems);
  const meta = r.obj(root["program"], "program") ?? {};
  const id = r.str(meta, "id", "program");
  if (id && !PROGRAM_ID.test(id)) r.problems.push(`program.id: "${id}" is not a slug`);
  const totalDays = r.int(meta, "total_days", "program", 1, 366);
  const phases = readPhases(r, meta, totalDays);
  const days = r
    .arr(root, "days", "$")
    .map((raw, i) => readDay(r, raw, i, phases))
    .sort((a, b) => a.day - b.day);

  if (days.length !== totalDays) {
    r.problems.push(`days: expected ${totalDays} entries, got ${days.length}`);
  }
  days.forEach((d, i) => {
    if (d.day !== i + 1) r.problems.push(`days: expected day ${i + 1}, found day ${d.day}`);
  });
  const ytIds = new Set<string>();
  for (const d of days) {
    if (ytIds.has(d.video.youtubeId)) r.problems.push(`days: duplicate video ${d.video.youtubeId}`);
    ytIds.add(d.video.youtubeId);
  }

  const program: Program = {
    id,
    title: { id: r.str(meta, "title_id", "program"), en: r.str(meta, "title_en", "program") },
    hijriYear: r.int(meta, "hijri_year", "program", 1, 3000),
    totalDays,
    status: r.str(meta, "status", "program"),
    phases,
    days,
  };
  if (r.problems.length > 0) throw new ProgramError(r.problems);
  return program;
}

/** The only `status` that may reach users in a production build. */
export const APPROVED_STATUS = "approved";

/** Unapproved content shows in development builds only; `dev` is `__DEV__`. */
export function isReleasable(program: Pick<Program, "status">, dev: boolean): boolean {
  return program.status === APPROVED_STATUS || dev;
}

export function dayOf(program: Program, day: number): ProgramDay | null {
  return program.days[day - 1] ?? null;
}
