import { normalizeDegrees, turnTo } from "@waqtu/core";

/** The heading fields expo-location's `watchHeadingAsync` reports. */
export interface HeadingReading {
  /** Degrees from true north; negative when the platform cannot tell (no location fix yet). */
  trueHeading: number;
  magHeading: number;
  /** Calibration: 3 high, 2 medium, 1 low, 0 none (iOS maps its error in degrees onto the same scale). */
  accuracy: number;
}

export interface Heading {
  degrees: number;
  /** False when only the magnetic heading was available. */
  trueNorth: boolean;
}

/** True north when the platform has it, otherwise magnetic north; null for a reading without a usable figure. */
export function headingOf(reading: HeadingReading): Heading | null {
  if (Number.isFinite(reading.trueHeading) && reading.trueHeading >= 0) {
    return { degrees: normalizeDegrees(reading.trueHeading), trueNorth: true };
  }
  if (Number.isFinite(reading.magHeading) && reading.magHeading >= 0) {
    return { degrees: normalizeDegrees(reading.magHeading), trueNorth: false };
  }
  return null;
}

/** Low or no calibration: time to show the figure-8 hint. */
export function needsCalibration(accuracy: number): boolean {
  return !(accuracy >= 2);
}

/**
 * The angle to animate to after `previous` when the heading is now `next`: `previous` plus the short turn, so a needle
 * going from 359° to 1° turns 2° forwards instead of spinning back through 358°.
 */
export function unwrapAngle(previous: number, next: number): number {
  return previous + turnTo(previous, next);
}
