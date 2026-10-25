import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";

import { Section, StepperRow } from "@/components/ui";
import { getSetting, setSetting } from "@/db/settings";
import { useTranslation } from "@/i18n";
import { requestNotificationPermission } from "@/notifications/setup";
import { Hint, Panel, ToggleRow } from "@/ramadhan/components/fields";
import {
  DEFAULT_NUDGE_TIME,
  formatNudgeTime,
  NUDGE_KEY,
  parseNudgeTime,
  type NudgeTime,
} from "../nudge";

const MINUTE_STEP = 5;
const pad = (n: number) => String(n).padStart(2, "0");

/** Opt-in daily reminder at a time the user picks; stored on this device only. */
export function NudgeSettings() {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const [time, setTime] = useState<NudgeTime | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getSetting(db, NUDGE_KEY).then((raw) => {
      if (cancelled) return;
      setTime(parseNudgeTime(raw));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  if (!loaded) return null;

  const save = (next: NudgeTime | null) => {
    setTime(next);
    void setSetting(db, NUDGE_KEY, next ? formatNudgeTime(next) : null).catch(() => {});
  };

  const toggle = async (on: boolean) => {
    if (!on) {
      save(null);
      return;
    }
    const status = await requestNotificationPermission().catch(() => "denied" as const);
    setDenied(status !== "granted");
    save(time ?? DEFAULT_NUDGE_TIME);
  };

  return (
    <Section title={t("halaqah.nudge.section")} icon="notifications-outline" hue="halaqah">
      <ToggleRow
        label={t("halaqah.nudge.toggle")}
        hint={time ? t("halaqah.nudge.at", { time: formatNudgeTime(time) }) : undefined}
        value={time !== null}
        onValueChange={(on) => void toggle(on)}
      />
      {time ? (
        <>
          <StepperRow
            label={t("halaqah.nudge.hour")}
            value={time.hour}
            min={0}
            max={23}
            format={pad}
            onChange={(hour) => save({ ...time, hour })}
          />
          <StepperRow
            label={t("halaqah.nudge.minute")}
            value={time.minute}
            min={0}
            max={60 - MINUTE_STEP}
            format={pad}
            onChange={(minute) =>
              save({
                ...time,
                minute:
                  minute > time.minute
                    ? Math.min(60 - MINUTE_STEP, time.minute + MINUTE_STEP)
                    : Math.max(0, time.minute - MINUTE_STEP),
              })
            }
          />
        </>
      ) : null}
      <Panel>
        <Hint>{denied ? t("halaqah.nudge.denied") : t("halaqah.nudge.hint")}</Hint>
      </Panel>
    </Section>
  );
}
