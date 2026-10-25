import { Ionicons } from "@expo/vector-icons";
import { surahInfo, type HafalanTarget } from "@waqtu/core";
import { StyleSheet, Text, View } from "react-native";

import { Card, IconChip, type IconName } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { ProgressBar } from "@/ramadhan/components/fields";
import { spacing, tabular, typography, useTheme } from "@/theme";
import type { HafalanData } from "../useHafalan";

/** `Juz 30`, `Surah An-Naba'`, `Halaman 582–604`: what the plan covers. */
export function targetLabel(
  target: HafalanTarget,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const single = target.from === target.to;
  if (target.kind === "surah") {
    return single
      ? t("hafalan.target.surah", { name: surahInfo(target.from).id })
      : t("hafalan.target.surahRange", {
          from: surahInfo(target.from).id,
          to: surahInfo(target.to).id,
        });
  }
  return t(`hafalan.target.${target.kind}${single ? "" : "Range"}`, {
    from: target.from,
    to: target.to,
  });
}

/** The plan's title, dates, progress and how it stands against its schedule. */
export function PlanOverview({ data }: { data: HafalanData }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { plan, stats, portion } = data;
  const schedule =
    portion.phase === "upcoming"
      ? {
          icon: "calendar-outline" as const,
          color: theme.muted,
          text: t("hafalan.upcoming", { day: plan.startDay }),
        }
      : stats.behind > 0
        ? {
            icon: "hourglass-outline" as const,
            color: theme.secondary,
            text: t("hafalan.behind", { count: stats.behind }),
          }
        : {
            icon: stats.ahead > 0 ? ("trending-up" as const) : ("checkmark-circle" as const),
            color: theme.accent,
            text:
              stats.ahead > 0 ? t("hafalan.ahead", { count: stats.ahead }) : t("hafalan.onTrack"),
          };
  return (
    <Card>
      <View style={styles.head}>
        <IconChip icon="book" size={48} />
        <View style={styles.grow}>
          <Text style={[typography.overline, { color: theme.muted }]}>
            {t("hafalan.planTitle")}
          </Text>
          <Text style={[typography.title, { color: theme.text }]}>
            {targetLabel(plan.target, t)}
          </Text>
          <Text style={[typography.footnote, tabular, { color: theme.muted }]}>
            {t("hafalan.planDates", { start: plan.startDay, deadline: plan.deadline })}
          </Text>
        </View>
      </View>
      <View style={styles.figureRow}>
        <Text style={[styles.figure, tabular, { color: theme.countdown }]}>{stats.percent}%</Text>
        <Text style={[typography.subhead, tabular, styles.grow, { color: theme.muted }]}>
          {t("hafalan.progress", {
            learned: stats.learned,
            total: stats.total,
            percent: stats.percent,
          })}
        </Text>
      </View>
      <ProgressBar fraction={stats.total === 0 ? 0 : stats.learned / stats.total} />
      <View style={styles.lines}>
        {stats.mastered > 0 ? (
          <Line
            icon="ribbon-outline"
            color={theme.gold}
            text={t("hafalan.mastered", { count: stats.mastered })}
          />
        ) : null}
        <Line icon={schedule.icon} color={schedule.color} text={schedule.text} strong />
        {portion.phase === "pastDeadline" ? (
          <Line icon="alarm-outline" color={theme.warning} text={t("hafalan.pastDeadline")} />
        ) : stats.etaDay ? (
          <Line
            icon="flag-outline"
            color={theme.muted}
            text={t("hafalan.eta", { day: stats.etaDay })}
          />
        ) : null}
      </View>
    </Card>
  );
}

/** One status line under the progress bar: a small glyph and its text. */
function Line({
  icon,
  color,
  text,
  strong,
}: {
  icon: IconName;
  color: string;
  text: string;
  strong?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.line}>
      <Ionicons
        name={icon}
        size={16}
        color={color}
        style={styles.lineIcon}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text
        style={[
          typography.subhead,
          styles.grow,
          strong ? { color, fontWeight: "600" } : { color: theme.muted },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md - 4 },
  grow: { flex: 1, gap: 2 },
  figureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 4,
    marginTop: spacing.sm,
  },
  figure: { fontSize: 40, fontWeight: "800", letterSpacing: -0.8 },
  lines: { gap: spacing.xs + 2, marginTop: spacing.xs },
  line: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  lineIcon: { marginTop: 2 },
});
