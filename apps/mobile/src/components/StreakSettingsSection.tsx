import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";

import { getSetting, setSyncedSetting } from "@/db/settings";
import { onDataChanged } from "@/db/events";
import { useTranslation } from "@/i18n";
import { dayKeyInZone } from "@/mutabaah/dates";
import {
  endPause,
  MAX_GRACE_DAYS,
  parseStreakConfig,
  serializeStreakConfig,
  startPause,
  type StreakConfig,
} from "@/mutabaah/streak";
import { ITEMS_KEY, STREAK_KEY } from "@/mutabaah/syncKeys";
import { parseItems } from "@/mutabaah/items";
import { PRAYER_KEYS } from "@/prayer/config";

import { Row, Section, StepperRow } from "./ui";

export function StreakSettingsSection() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { t } = useTranslation();
  const [config, setConfig] = useState<StreakConfig | null>(null);
  const [itemCount, setItemCount] = useState(0);
  const [version, setVersion] = useState(0);

  useEffect(() => onDataChanged(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = parseStreakConfig(await getSetting(db, STREAK_KEY));
      const count = parseItems(await getSetting(db, ITEMS_KEY)).length;
      if (!cancelled) {
        setConfig(next);
        setItemCount(count);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, version]);

  if (!config) return null;

  const save = (next: StreakConfig) => {
    setConfig(next);
    void setSyncedSetting(db, STREAK_KEY, serializeStreakConfig(next));
  };
  const pauseActive = config.pauses.some((p) => p.to === null);
  const togglePause = async () => {
    const zone = (await getSetting(db, PRAYER_KEYS.tz)) ?? undefined;
    const today = dayKeyInZone(new Date(), zone);
    save(pauseActive ? endPause(config, today) : startPause(config, today));
  };

  return (
    <Section title={t("streakSettings.title")}>
      <Row label={t("items.manage")} onPress={() => router.push("/items")} />
      <StepperRow
        label={t("streakSettings.grace", { count: config.graceDays })}
        value={config.graceDays}
        min={0}
        max={MAX_GRACE_DAYS}
        onChange={(graceDays) => save({ ...config, graceDays })}
      />
      <StepperRow
        label={t("streakSettings.minDone", { count: config.minDone })}
        value={config.minDone}
        min={1}
        max={Math.max(1, itemCount)}
        onChange={(minDone) => save({ ...config, minDone })}
      />
      <Row
        label={pauseActive ? t("streakSettings.pauseEnd") : t("streakSettings.pauseStart")}
        selected={pauseActive}
        onPress={() => void togglePause()}
      />
    </Section>
  );
}
