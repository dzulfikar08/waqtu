import type { FastingCountdown } from "@waqtu/core";
import { formatLocalTime } from "@waqtu/core";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { requestNotificationPermission } from "@/notifications/setup";
import { radius, spacing, useTheme } from "@/theme";
import { formatCountdown } from "../dates";
import { hideLiveCountdown, showLiveCountdown } from "../liveCountdown";
import { KEYS } from "../settings";
import { getSetting, setSetting } from "@/db/settings";
import { Hint, Panel, ToggleRow } from "./fields";

export function CountdownCard({
  now,
  countdown,
  timeZone,
}: {
  now: Date;
  countdown: FastingCountdown | null;
  timeZone: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const db = useSQLiteContext();
  const [live, setLive] = useState(false);
  const [liveNote, setLiveNote] = useState<"denied" | "unavailable" | null>(null);

  useEffect(() => {
    void getSetting(db, KEYS.liveCountdown).then((v) => setLive(v === "1"));
  }, [db]);

  const targetMs = countdown ? +countdown.at : null;
  const target = countdown?.target;
  const phase = countdown?.phase;

  // (Re)post the lock-screen countdown whenever the target changes, and clear it when switched off.
  useEffect(() => {
    if (!live || targetMs === null || !target || !phase) {
      void hideLiveCountdown(db).catch(() => {});
      return;
    }
    const time = formatLocalTime(new Date(targetMs), timeZone);
    void showLiveCountdown(
      db,
      { phase, target, at: new Date(targetMs), msRemaining: targetMs - Date.now() },
      {
        title: t(
          phase === "sahur"
            ? "ramadhan.countdown.notificationTitleSahur"
            : "ramadhan.countdown.notificationTitleFasting",
        ),
        text: t("ramadhan.countdown.at", { prayer: t(`ramadhan.countdown.${target}`), time }),
        channelName: t("ramadhan.countdown.notificationChannel"),
      },
    )
      .then((shown) => setLiveNote(shown ? null : "unavailable"))
      .catch(() => setLiveNote("unavailable"));
  }, [db, live, targetMs, target, phase, timeZone, t]);

  const toggleLive = async (next: boolean) => {
    if (next) {
      const status = await requestNotificationPermission();
      if (status !== "granted") {
        setLiveNote("denied");
        return;
      }
    }
    setLiveNote(null);
    setLive(next);
    await setSetting(db, KEYS.liveCountdown, next ? "1" : "0");
  };

  return (
    <Section title={t("ramadhan.tab")}>
      <Panel>
        {countdown ? (
          <View
            style={[styles.hero, { backgroundColor: theme.background, borderColor: theme.border }]}
          >
            <Text style={[styles.label, { color: theme.muted }]}>
              {t(
                countdown.phase === "sahur"
                  ? "ramadhan.countdown.sahur"
                  : "ramadhan.countdown.fasting",
              )}
            </Text>
            <Text accessibilityRole="timer" style={[styles.clock, { color: theme.accent }]}>
              {formatCountdown(+countdown.at - +now)}
            </Text>
            <Text style={{ color: theme.text }}>
              {t("ramadhan.countdown.at", {
                prayer: t(`ramadhan.countdown.${countdown.target}`),
                time: formatLocalTime(countdown.at, timeZone),
              })}
            </Text>
          </View>
        ) : (
          <Hint>{t("ramadhan.noPrayerTimes")}</Hint>
        )}
      </Panel>
      <ToggleRow
        label={t("ramadhan.countdown.live")}
        hint={t("ramadhan.countdown.liveHint")}
        value={live}
        onValueChange={(v) => void toggleLive(v)}
        disabled={!countdown}
      />
      {liveNote ? (
        <Panel>
          <Hint>
            {t(
              liveNote === "denied"
                ? "ramadhan.countdown.liveDenied"
                : "ramadhan.countdown.liveUnavailable",
            )}
          </Hint>
        </Panel>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 14, fontWeight: "600", textTransform: "uppercase" },
  clock: { fontSize: 48, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
