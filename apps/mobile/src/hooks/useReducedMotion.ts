import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** The last answer from the system, so a view mounted later starts with the right value instead of `false`. */
let known = false;

/** True while the system "reduce motion" / "remove animations" setting is on: looping decoration then stays still. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(known);
  useEffect(() => {
    let live = true;
    const adopt = (value: boolean) => {
      known = value;
      if (live) setReduced(value);
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(adopt);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", adopt);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
