import { surahInfo, type HafalanTarget } from "@waqtu/core";
import { StyleSheet, Text, View } from "react-native";

import { useTranslation } from "@/i18n";
import { Hint, ProgressBar } from "@/ramadhan/components/fields";
import { spacing, useTheme } from "@/theme";
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
  return (
    <View style={styles.box}>
      <Text style={[styles.title, { color: theme.text }]}>{targetLabel(plan.target, t)}</Text>
      <Hint>{t("hafalan.planDates", { start: plan.startDay, deadline: plan.deadline })}</Hint>
      <ProgressBar fraction={stats.total === 0 ? 0 : stats.learned / stats.total} />
      <Text style={{ color: theme.text }}>
        {t("hafalan.progress", {
          learned: stats.learned,
          total: stats.total,
          percent: stats.percent,
        })}
      </Text>
      {stats.mastered > 0 ? <Hint>{t("hafalan.mastered", { count: stats.mastered })}</Hint> : null}
      {portion.phase === "upcoming" ? (
        <Text style={{ color: theme.muted }}>{t("hafalan.upcoming", { day: plan.startDay })}</Text>
      ) : (
        <Text style={{ color: stats.behind > 0 ? theme.secondary : theme.accent }}>
          {stats.behind > 0
            ? t("hafalan.behind", { count: stats.behind })
            : stats.ahead > 0
              ? t("hafalan.ahead", { count: stats.ahead })
              : t("hafalan.onTrack")}
        </Text>
      )}
      {portion.phase === "pastDeadline" ? (
        <Text style={{ color: theme.muted }}>{t("hafalan.pastDeadline")}</Text>
      ) : stats.etaDay ? (
        <Hint>{t("hafalan.eta", { day: stats.etaDay })}</Hint>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm, paddingHorizontal: spacing.sm },
  title: { fontSize: 24, fontWeight: "700" },
});
