import { clampCount, type ItemDef } from "../mutabaah/items";

/** A phrase from content/adhkar/tasbih.json (the Mutabaah app's tasbih presets, unmodified). */
export interface TasbihPhrase {
  id: string;
  name: string;
  arabic: string;
  transliteration: string;
  /** English, as in the source. */
  translation: string;
  recommendedCount: number;
}

export type PresetId = "afterPrayer" | "tahlil" | "istighfar" | "salawat" | "custom";

export const PRESET_IDS: readonly PresetId[] = [
  "afterPrayer",
  "tahlil",
  "istighfar",
  "salawat",
  "custom",
];

/** One stretch of a preset: a phrase (none for a free count) said `target` times; target 0 counts without end. */
export interface Phase {
  phrase: TasbihPhrase | null;
  target: number;
}

export interface TasbihState {
  preset: PresetId;
  /** Taps since the last reset, across rounds. */
  count: number;
  /** Target of the free count; 0 counts without a target. */
  customTarget: number;
  vibrate: boolean;
  /** A custom counter item of the mutabaah checklist the count can be added to. */
  linkedItem: string | null;
}

export const DEFAULT_TASBIH: TasbihState = {
  preset: "afterPrayer",
  count: 0,
  customTarget: 0,
  vibrate: true,
  linkedItem: null,
};

export const TASBIH_KEY = "ibadah.tasbih";
export const MAX_TASBIH = 1_000_000;
export const MAX_CUSTOM_TARGET = 10_000;

export class TasbihContentError extends Error {}

export function parsePhrases(raw: unknown): TasbihPhrase[] {
  if (typeof raw !== "object" || raw === null || !("phrases" in raw) || !Array.isArray(raw.phrases)) {
    throw new TasbihContentError("tasbih: expected phrases");
  }
  return raw.phrases.map((entry: unknown, index): TasbihPhrase => {
    if (typeof entry !== "object" || entry === null) {
      throw new TasbihContentError(`tasbih.phrases[${index}]: expected an object`);
    }
    const fields = new Map<string, unknown>(Object.entries(entry));
    const text = (key: string): string => {
      const value = fields.get(key);
      if (typeof value !== "string" || value.trim() === "") {
        throw new TasbihContentError(`tasbih.phrases[${index}].${key}: expected text`);
      }
      return value;
    };
    const count = fields.get("recommendedCount");
    if (typeof count !== "number" || !Number.isInteger(count) || count < 1) {
      throw new TasbihContentError(`tasbih.phrases[${index}].recommendedCount: expected a count`);
    }
    return {
      id: text("id"),
      name: text("name"),
      arabic: text("arabic"),
      transliteration: text("transliteration"),
      translation: text("translation"),
      recommendedCount: count,
    };
  });
}

let phrases: TasbihPhrase[] | undefined;

export function loadPhrases(): readonly TasbihPhrase[] {
  phrases ??= parsePhrases(require("../../../../content/adhkar/tasbih.json"));
  return phrases;
}

function phrase(all: readonly TasbihPhrase[], id: string): TasbihPhrase {
  const found = all.find((p) => p.id === id);
  if (!found) throw new TasbihContentError(`tasbih: missing phrase ${id}`);
  return found;
}

/** The stretches of a preset: 33/33/34 after the prayer, 100 of one phrase, or the free count. */
export function presetPhases(
  preset: PresetId,
  all: readonly TasbihPhrase[],
  customTarget: number,
): Phase[] {
  const of = (id: string): Phase => {
    const p = phrase(all, id);
    return { phrase: p, target: p.recommendedCount };
  };
  switch (preset) {
    case "afterPrayer":
      return [of("subhanallah"), of("alhamdulillah"), of("allahu-akbar")];
    case "tahlil":
    case "istighfar":
    case "salawat":
      return [of(preset)];
    case "custom":
      return [{ phrase: null, target: customTarget }];
  }
}

/** Taps in one full round of the phases; 0 when the count has no end. */
export function roundLength(phases: readonly Phase[]): number {
  if (phases.some((p) => p.target <= 0)) return 0;
  return phases.reduce((sum, p) => sum + p.target, 0);
}

export interface TasbihPosition {
  phase: number;
  /** Count within the phase, 0 to its target. */
  inPhase: number;
  target: number;
  /** Rounds finished before the current one. */
  rounds: number;
  /** The current round has just been finished (the counter shows its full target until the next tap). */
  roundComplete: boolean;
}

/** Where `count` taps land: a finished round stays on show (34/34) until the next tap begins the next round. */
export function positionOf(count: number, phases: readonly Phase[]): TasbihPosition {
  const round = roundLength(phases);
  if (round === 0) {
    return { phase: 0, inPhase: count, target: 0, rounds: 0, roundComplete: false };
  }
  const inRound = count === 0 ? 0 : ((count - 1) % round) + 1;
  const rounds = count === 0 ? 0 : Math.floor((count - 1) / round);
  let before = 0;
  for (let i = 0; i < phases.length; i++) {
    const end = before + phases[i].target;
    if (inRound <= end) {
      return {
        phase: i,
        inPhase: inRound - before,
        target: phases[i].target,
        rounds,
        roundComplete: inRound === round,
      };
    }
    before = end;
  }
  const last = phases.length - 1;
  return {
    phase: last,
    inPhase: phases[last].target,
    target: phases[last].target,
    rounds,
    roundComplete: true,
  };
}

/** What a tap reached: a plain count, the end of a phase (33 → the next phrase), or the end of a round. */
export type TapEvent = "tick" | "phase" | "round";

export function tap(state: TasbihState, phases: readonly Phase[]): { state: TasbihState; event: TapEvent } {
  const count = Math.min(MAX_TASBIH, state.count + 1);
  const next = { ...state, count };
  const at = positionOf(count, phases);
  if (at.roundComplete) return { state: next, event: "round" };
  if (at.target > 0 && at.inPhase === at.target) return { state: next, event: "phase" };
  return { state: next, event: "tick" };
}

export function undo(state: TasbihState): TasbihState {
  return { ...state, count: Math.max(0, state.count - 1) };
}

export function reset(state: TasbihState): TasbihState {
  return { ...state, count: 0 };
}

/** Switching preset starts the count again; the free count keeps its target. */
export function choosePreset(state: TasbihState, preset: PresetId): TasbihState {
  return preset === state.preset ? state : { ...state, preset, count: 0 };
}

export function setCustomTarget(state: TasbihState, target: number): TasbihState {
  const customTarget = Math.max(0, Math.min(MAX_CUSTOM_TARGET, Math.trunc(target)));
  return { ...state, customTarget };
}

function isPreset(value: unknown): value is PresetId {
  return typeof value === "string" && (PRESET_IDS as readonly string[]).includes(value);
}

/** Stored state → state; missing or malformed fields take their defaults, so a bad value never loses the rest. */
export function parseTasbih(raw: string | null | undefined): TasbihState {
  if (!raw) return DEFAULT_TASBIH;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return DEFAULT_TASBIH;
  }
  if (typeof data !== "object" || data === null) return DEFAULT_TASBIH;
  const fields = new Map<string, unknown>(Object.entries(data));
  const count = fields.get("count");
  const customTarget = fields.get("customTarget");
  const vibrate = fields.get("vibrate");
  const linkedItem = fields.get("linkedItem");
  const preset = fields.get("preset");
  return {
    preset: isPreset(preset) ? preset : DEFAULT_TASBIH.preset,
    count:
      typeof count === "number" && Number.isInteger(count) && count >= 0 && count <= MAX_TASBIH
        ? count
        : 0,
    customTarget:
      typeof customTarget === "number" &&
      Number.isInteger(customTarget) &&
      customTarget >= 0 &&
      customTarget <= MAX_CUSTOM_TARGET
        ? customTarget
        : 0,
    vibrate: typeof vibrate === "boolean" ? vibrate : true,
    linkedItem: typeof linkedItem === "string" && linkedItem.length <= 64 ? linkedItem : null,
  };
}

export function serializeTasbih(state: TasbihState): string {
  return JSON.stringify(state);
}

/** Checklist items the count can be added to: the user's own counters (not the built-in pages of tilawah). */
export function linkableItems(items: readonly ItemDef[]): ItemDef[] {
  return items.filter((item) => item.kind === "count" && item.id.startsWith("c."));
}

/** The linked item, if it is still on the checklist and still a counter. */
export function linkedItemOf(state: TasbihState, items: readonly ItemDef[]): ItemDef | null {
  return linkableItems(items).find((item) => item.id === state.linkedItem) ?? null;
}

/** Today's value of the linked counter after adding the tasbih count. */
export function addedCount(current: number, count: number): number {
  return clampCount(current + count);
}
