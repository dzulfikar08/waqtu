import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { useTranslation } from "@/i18n";
import type { StreakResult } from "@/mutabaah/streak";
import { spacing, tabular, typography, useTheme } from "@/theme";

import { Card } from "../ui";

/** Streak with forgiving copy: never a loss message, a missed day is simply not mentioned. */
export function StreakCard({ streak }: { streak: StreakResult }) {
  const { t } = useTranslation();
  const theme = useTheme();
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
    <Card>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: theme.goldSoft }]}>
          <Ionicons
            name={streak.paused ? "pause" : "flame"}
            size={24}
            color={theme.gold}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </View>
        <View style={styles.grow}>
          <Text style={[typography.overline, { color: theme.muted }]}>{t("streak.title")}</Text>
          <Text style={[styles.figure, tabular, { color: theme.text }]}>
            {t("streak.days", { count: streak.current })}
          </Text>
        </View>
        {streak.best > streak.current ? (
          <Text style={[typography.footnote, styles.best, { color: theme.muted }]}>
            {t("streak.best", { count: streak.best })}
          </Text>
        ) : null}
      </View>
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
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  grow: { flex: 1, gap: 2 },
  figure: { fontSize: 26, fontWeight: "800", letterSpacing: -0.4 },
  best: { maxWidth: 120, textAlign: "right" },
  lines: { gap: 2, marginTop: spacing.xs },
});
