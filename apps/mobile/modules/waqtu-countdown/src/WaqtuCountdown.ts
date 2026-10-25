import { requireOptionalNativeModule } from "expo";

interface WaqtuCountdownModule {
  /**
   * Posts the ongoing countdown notification, replacing any previous one. Resolves false when
   * notifications are blocked or `targetAtMs` is not in the future.
   */
  show(title: string, text: string, targetAtMs: number, channelName: string): boolean;
  cancel(): void;
  /**
   * Replaces what the home-screen widget counts down to: a JSON array of `{ at, title, text }`
   * (`at` in epoch ms). The widget shows the first entry still in the future and moves on by itself.
   */
  setWidgetSchedule(json: string): void;
}

/** Android only; null on iOS and wherever the native module is not linked (Expo Go). */
export default requireOptionalNativeModule<WaqtuCountdownModule>("WaqtuCountdown");
