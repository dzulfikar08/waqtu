import { requireOptionalNativeModule } from "expo";

interface WaqtuCountdownModule {
  /**
   * Posts the ongoing countdown notification, replacing any previous one. Resolves false when
   * notifications are blocked or `targetAtMs` is not in the future.
   */
  show(title: string, text: string, targetAtMs: number, channelName: string): boolean;
  cancel(): void;
}

/** Android only; null on iOS and wherever the native module is not linked (Expo Go). */
export default requireOptionalNativeModule<WaqtuCountdownModule>("WaqtuCountdown");
