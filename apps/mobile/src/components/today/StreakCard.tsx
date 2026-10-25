import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { useTranslation } from "@/i18n";
import { civilOf, type DayKey } from "@/mutabaah/dates";
import type { StreakResult } from "@/mutabaah/streak";
import type { DaySummary } from "@/mutabaah/week";
import { hueColors, spacing, tabular, typography, useTheme } from "@/theme";

import { Card } from "../ui";

function weekday(day: DayKey, locale: string): string {
  const { year, month, day: d } = civilOf(day);
  return new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, d, 12)),
  );
}

/**
 * Streak with forgiving copy: never a loss message, a missed day is simply not mentioned. Amber, with the last seven
 * days as flames: lit where the day counted, today ringed.
 */
export function StreakCard({
  streak,
  days,
  today,
}: {
  streak: StreakResult;
  /** The last seven days, oldest first. */
  days: readonly DaySummary[];
  today: DayKey;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const amber = hueColors(theme, "streak");
  const lines: string[] = [];
  if (streak.paused) lines.push(t("streak.paused"));
  else if (streak.current === 0) lines.push(t("streak.start"));
  else lines.push(t("streak.going"));
  if (streak.forgiven > 0) lines.push(t("streak.forgiven", { count: streak.forgiven }));
  if (streak.current > 0 && !streak.paused)
    lines.push(t("streak.graceLeft", { count: streak.graceLeft }));
  if (!streak.countedToday && streak.current > 0 && !streak.paused)
    lines.push(t("streak.todayOpen"));

  return (
    <Card hue="streak">
      <View style={styles.head}>
        <View
          style={[
            styles.badge,
            {
              experimental_backgroundImage: `radial-gradient(circle, ${amber.soft} 0%, ${amber.wash} 100%)`,
            },
          ]}
        >
          <Ionicons
            name={streak.paused ? "pause" : "flame"}
            size={26}
            color={amber.base}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </View>
        <View style={styles.grow}>
          <Text style={[typography.overline, { color: amber.base }]}>{t("streak.title")}</Text>
          <Text style={[styles.figure, tabular, { color: theme.text }]}>
            {t("streak.days", { count: streak.current })}
          </Text>
        </View>
        {streak.best > streak.current ? (
          <View style={[styles.best, { backgroundColor: amber.soft }]}>
            <Ionicons name="trophy" size={13} color={amber.base} />
            <Text style={[typography.caption, { color: amber.base, fontWeight: "700" }]}>
              {t("streak.best", { count: streak.best })}
            </Text>
          </View>
        ) : null}
      </View>
      {days.length > 0 ? (
        <View
          style={styles.week}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          {days.map((day) => {
            const isToday = day.date === today;
            return (
              <View key={day.date} style={styles.day}>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: day.counted ? amber.base : amber.wash,
                      borderColor: isToday ? amber.base : "transparent",
                    },
                  ]}
                >
                  <Ionicons
                    name="flame"
                    size={14}
                    color={day.counted ? theme.surface : theme.faint}
                  />
                </View>
                <Text
                  style={[
                    typography.caption,
                    {
                      color: isToday ? amber.base : theme.muted,
                      fontWeight: isToday ? "800" : "500",
                    },
                  ]}
                >
                  {weekday(day.date, i18n.language)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
      <View style={styles.lines}>
        {lines.map((line) => (
          <Text key={line} style={[typography.subhead, { color: theme.muted, lineHeight: 20 }]}>
            {line}
          </Text>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md - 4 },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  grow: { flex: 1, gap: 2 },
  figure: { fontSize: 28, fontWeight: "800", letterSpacing: -0.4 },
  best: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    maxWidth: 140,
  },
  week: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  day: { alignItems: "center", gap: 4 },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  lines: { gap: 2, marginTop: spacing.xs },
});
