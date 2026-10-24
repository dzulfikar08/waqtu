import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

interface ExactAlarmNative {
  canSchedule(): boolean;
  openSettings(): void;
}

// Android only; elsewhere (and in builds without the module) alarms are not restricted.
const native =
  Platform.OS === "android" ? requireOptionalNativeModule<ExactAlarmNative>("ExactAlarm") : null;

/** False only on Android 12+ when the user turned off "Alarms & reminders" for the app. */
export function canScheduleExactAlarms(): boolean {
  return native ? native.canSchedule() : true;
}

/** Opens the system "Alarms & reminders" screen for this app (Android 12+). */
export function openExactAlarmSettings(): void {
  native?.openSettings();
}
