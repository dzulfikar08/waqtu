import { StyleSheet, Text, View } from "react-native";

import { useTranslation } from "@/i18n";
import type { StreakResult } from "@/mutabaah/streak";
import { radius, spacing, useTheme } from "@/theme";

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
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.head}>
        <Text
          style={{
            color: theme.muted,
            fontSize: 13,
            fontWeight: "600",
            textTransform: "uppercase",
          }}
        >
          {t("streak.title")}
        </Text>
        <Text style={{ color: theme.accent, fontSize: 28, fontWeight: "700" }}>
          {t("streak.days", { count: streak.current })}
        </Text>
        {streak.best > streak.current ? (
          <Text style={{ color: theme.muted, fontSize: 13 }}>
            {t("streak.best", { count: streak.best })}
          </Text>
        ) : null}
      </View>
      {lines.map((line) => (
        <Text key={line} style={{ color: theme.text, fontSize: 14 }}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.xs,
  },
  head: { gap: 2 },
});
