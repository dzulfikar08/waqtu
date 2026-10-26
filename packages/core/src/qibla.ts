/** The Kaaba, Masjid al-Haram, Makkah. */
export const KAABA = { latitude: 21.4225, longitude: 39.8262 } as const;

const RAD = Math.PI / 180;

/** `degrees` folded into [0, 360). */
export function normalizeDegrees(degrees: number): number {
  const folded = degrees % 360;
  return folded < 0 ? folded + 360 : folded;
}

/**
 * Qibla direction from a place: the initial bearing of the great circle to the Kaaba, in degrees clockwise from true
 * north, in [0, 360). The same formula as Adhan's `Qibla` (which the Swift app used), with the Kaaba at 21.4225°N 39.8262°E.
 */
export function qiblaBearing(latitude: number, longitude: number): number {
  const phi = latitude * RAD;
  const phiK = KAABA.latitude * RAD;
  const dLambda = (KAABA.longitude - longitude) * RAD;
  const y = Math.sin(dLambda);
  const x = Math.cos(phi) * Math.tan(phiK) - Math.sin(phi) * Math.cos(dLambda);
  return normalizeDegrees(Math.atan2(y, x) / RAD);
}

/** Signed turn from `heading` to `target`, in (-180, 180]: positive turns right (clockwise), negative left. */
export function turnTo(heading: number, target: number): number {
  const delta = normalizeDegrees(target - heading);
  return delta > 180 ? delta - 360 : delta;
}

/** Whether a phone pointing at `heading` faces `target` within `tolerance` degrees either side. */
export function isAligned(heading: number, target: number, tolerance = 3): boolean {
  return Math.abs(turnTo(heading, target)) <= tolerance;
}

/** Great-circle distance to the Kaaba in kilometres (mean Earth radius). */
export function distanceToKaabaKm(latitude: number, longitude: number): number {
  const phi1 = latitude * RAD;
  const phi2 = KAABA.latitude * RAD;
  const dPhi = phi2 - phi1;
  const dLambda = (KAABA.longitude - longitude) * RAD;
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(a)));
}
