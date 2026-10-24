import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { canScheduleExactAlarms } from "../../modules/exact-alarm";

/** Whether exact alarms are allowed; re-checked when the app returns from the system settings screen. */
export function useExactAlarmAllowed(): boolean {
  const [allowed, setAllowed] = useState(canScheduleExactAlarms);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setAllowed(canScheduleExactAlarms());
    });
    return () => sub.remove();
  }, []);
  return allowed;
}
