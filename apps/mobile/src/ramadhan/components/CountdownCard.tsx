import type { FastingCountdown } from "@waqtu/core";
import { formatLocalTime } from "@waqtu/core";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { SkyArt } from "@/components/today/PrayerCards";
import { Card, Divider, IconChip } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { requestNotificationPermission } from "@/notifications/setup";
import {
  hueColors,
  onSky,
  radius,
  skyGradient,
  spacing,
  tabular,
  typography,
  useTheme,
} from "@/theme";
import { formatCountdown } from "../dates";
import { hideLiveCountdown, showLiveCountdown } from "../liveCountdown";
import { KEYS } from "../settings";
import { getSetting, setSetting } from "@/db/settings";
import { Hint, Panel, ToggleRow } from "./fields";

/**
 * The fasting hero, as Today's next-prayer card: on the sunset sky while counting to iftar and the dawn sky while
 * counting to imsak, an iftar or sahur badge, the time it counts to and the live countdown in large white digits,
 * with the lock-screen countdown switch beneath on the card.
 */
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

  const period = countdown?.phase === "sahur" ? "fajr" : "maghrib";
  const gold = hueColors(theme, "ramadhan");

  return (
    <Card padded={false} hue="ramadhan">
      {countdown ? (
        <View
          style={[styles.sky, { experimental_backgroundImage: skyGradient(period, theme.dark) }]}
        >
          <SkyArt period={period} />
          <View style={styles.heroTop}>
            <IconChip
              icon={countdown.phase === "sahur" ? "moon" : "restaurant"}
              size={48}
              color={onSky.text}
              background={onSky.glassStrong}
            />
            <View style={styles.heroText}>
              <Text style={[typography.overline, { color: onSky.muted }]}>
                {t(
                  countdown.phase === "sahur"
                    ? "ramadhan.countdown.sahur"
                    : "ramadhan.countdown.fasting",
                )}
              </Text>
              <View style={[styles.glassPill, { backgroundColor: onSky.glass }]}>
                <Text style={[typography.headline, tabular, { color: onSky.text }]}>
                  {t("ramadhan.countdown.at", {
                    prayer: t(`ramadhan.countdown.${countdown.target}`),
                    time: formatLocalTime(countdown.at, timeZone),
                  })}
                </Text>
              </View>
            </View>
          </View>
          <Text
            accessibilityRole="timer"
            style={[styles.clock, tabular, { color: onSky.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatCountdown(+countdown.at - +now)}
          </Text>
        </View>
      ) : (
        <>
          <View style={[styles.hero, styles.heroTop]}>
            <IconChip icon="time-outline" size={40} color={gold.base} background={gold.soft} />
            <View style={styles.grow}>
              <Hint>{t("ramadhan.noPrayerTimes")}</Hint>
            </View>
          </View>
          <Divider />
        </>
      )}
      <View style={styles.rows}>
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
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { padding: spacing.md + 2 },
  sky: { padding: spacing.md + 4, paddingTop: spacing.md + 6, gap: spacing.sm, overflow: "hidden" },
  heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.md - 4 },
  heroText: { flex: 1, gap: 4, paddingRight: 72, alignItems: "flex-start" },
  grow: { flex: 1 },
  glassPill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  clock: { fontSize: 56, fontWeight: "800", letterSpacing: -1.2, marginTop: spacing.xs },
  // Clips the last row's hairline against the card's edge.
  rows: { marginBottom: -1 },
});
