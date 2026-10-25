import { Ionicons } from "@expo/vector-icons";
import { surahInfo, type HafalanTarget } from "@waqtu/core";
import { StyleSheet, Text, View } from "react-native";

import { ProgressTrack, type IconName } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { onSky, radius, spacing, tabular, typography, useTheme } from "@/theme";
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

/** The hafalan hero's teal-to-blue sky: [light, dark]. */
const HERO = {
  light: "linear-gradient(145deg, #0E7490 0%, #2B7BD8 100%)",
  dark: "linear-gradient(145deg, #0B2E3A 0%, #14304F 100%)",
} as const;

/** The plan's title, dates, progress and how it stands against its schedule, on the hafalan gradient. */
export function PlanOverview({ data }: { data: HafalanData }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { plan, stats, portion } = data;
  const schedule =
    portion.phase === "upcoming"
      ? {
          icon: "calendar-outline" as const,
          text: t("hafalan.upcoming", { day: plan.startDay }),
        }
      : stats.behind > 0
        ? {
            icon: "hourglass-outline" as const,
            text: t("hafalan.behind", { count: stats.behind }),
          }
        : {
            icon: stats.ahead > 0 ? ("trending-up" as const) : ("checkmark-circle" as const),
            text:
              stats.ahead > 0 ? t("hafalan.ahead", { count: stats.ahead }) : t("hafalan.onTrack"),
          };
  return (
    <View
      style={[
        styles.hero,
        {
          experimental_backgroundImage: theme.dark ? HERO.dark : HERO.light,
          boxShadow: theme.dark
            ? "0 10px 24px -12px rgba(0,0,0,0.6)"
            : "0 14px 28px -14px rgba(14,116,144,0.55)",
        },
      ]}
    >
      <HeroArt />
      <View style={styles.head}>
        <View
          style={[styles.badge, { backgroundColor: onSky.glassStrong, borderColor: onSky.line }]}
        >
          <Ionicons
            name="book"
            size={24}
            color={onSky.text}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </View>
        <View style={styles.grow}>
          <Text style={[typography.overline, { color: onSky.muted }]}>
            {t("hafalan.planTitle")}
          </Text>
          <Text style={[typography.title, { color: onSky.text }]}>
            {targetLabel(plan.target, t)}
          </Text>
          <Text style={[typography.footnote, tabular, { color: onSky.muted }]}>
            {t("hafalan.planDates", { start: plan.startDay, deadline: plan.deadline })}
          </Text>
        </View>
      </View>
      <View style={styles.figureRow}>
        <Text style={[styles.figure, tabular, { color: onSky.text }]}>{stats.percent}%</Text>
        <Text style={[typography.subhead, tabular, styles.grow, { color: onSky.muted }]}>
          {t("hafalan.progress", {
            learned: stats.learned,
            total: stats.total,
            percent: stats.percent,
          })}
        </Text>
      </View>
      <ProgressTrack
        value={stats.total === 0 ? 0 : stats.learned / stats.total}
        fill="rgba(255,255,255,0.95)"
        track={onSky.glass}
        height={8}
      />
      <View style={styles.lines}>
        {stats.mastered > 0 ? (
          <Line icon="ribbon-outline" text={t("hafalan.mastered", { count: stats.mastered })} />
        ) : null}
        <Line icon={schedule.icon} text={schedule.text} strong />
        {portion.phase === "pastDeadline" ? (
          <Line icon="alarm-outline" text={t("hafalan.pastDeadline")} strong />
        ) : stats.etaDay ? (
          <Line icon="flag-outline" text={t("hafalan.eta", { day: stats.etaDay })} />
        ) : null}
      </View>
    </View>
  );
}

/** A soft glow and two glass rings in the hero's top-right corner. Hidden from screen readers. */
function HeroArt() {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <View
        style={[
          styles.glow,
          {
            experimental_backgroundImage:
              "radial-gradient(circle at center, rgba(186,240,255,0.45) 0%, rgba(255,255,255,0) 68%)",
          },
        ]}
      />
      <View style={[styles.ring, styles.ringOuter]} />
      <View style={[styles.ring, styles.ringInner]} />
    </View>
  );
}

/** One status line under the progress bar: a small glyph and its text, white on the hero. */
function Line({ icon, text, strong }: { icon: IconName; text: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Ionicons
        name={icon}
        size={16}
        color={strong ? onSky.text : onSky.muted}
        style={styles.lineIcon}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text
        style={[
          typography.subhead,
          styles.grow,
          strong ? { color: onSky.text, fontWeight: "600" } : { color: onSky.muted },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.lg + 4,
    padding: spacing.md + 4,
    gap: spacing.sm,
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    width: 240,
    height: 240,
    top: -110,
    right: -90,
    borderRadius: 120,
  },
  ring: { position: "absolute", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  ringOuter: { width: 200, height: 200, borderRadius: 100, top: -86, right: -64 },
  ringInner: { width: 140, height: 140, borderRadius: 70, top: -56, right: -34 },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md - 4 },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  grow: { flex: 1, gap: 2 },
  figureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 4,
    marginTop: spacing.sm,
  },
  figure: { fontSize: 48, fontWeight: "800", letterSpacing: -1 },
  lines: { gap: spacing.xs + 2, marginTop: spacing.xs },
  line: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  lineIcon: { marginTop: 2 },
});
