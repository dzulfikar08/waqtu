/**
 * The recitation check is a developer feature until it passes the DEV-15 acceptance run
 * (docs/recitation/model-evaluation.md). It shows only when this device-local setting is on; the
 * switch sits in the hidden developer section of the About screen. Development builds (`__DEV__`)
 * have it on until it is switched off.
 */
export const DEV_RECITATION_KEY = "dev.recitation_check";
/** Device-local choice of model, `base` unless set. */
export const RECITATION_MODEL_KEY = "dev.recitation_model";

export function recitationCheckEnabled(stored: string | null, isDev: boolean): boolean {
  return stored === null ? isDev : stored === "1";
}

/** Taps on the version line of the About screen that reveal the developer section. */
export const DEV_MENU_TAPS = 7;
