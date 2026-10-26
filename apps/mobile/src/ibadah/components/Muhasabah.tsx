import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { PressableScale, ProgressTrack } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { civilOf, type DayKey } from "@/mutabaah/dates";
import { HIT, hueColors, radius, spacing, tabular, typography, useTheme } from "@/theme";

import {
  RATING_ASPECTS,
  RATING_EMOJI,
  RATING_MAX,
  RATING_MIN,
  monthWeeks,
  type RatingAspect,
  type TrendDay,
  type TrendSummary,
} from "../muhasabah";

const RATINGS = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => RATING_MIN + i);

function utcDate(day: DayKey): Date {
  const { year, month, day: d } = civilOf(day);
  return new Date(Date.UTC(year, month - 1, d, 12));
}

/** "Sabtu, 12 Februari" in the app's language. */
export function formatDay(day: DayKey, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(utcDate(day));
}

/** A 1–10 rating as ten numbered stops, the chosen one filled, with the aspect's emoji and the two ends of its scale. */
export function RatingPicker({
  aspect,
  value,
  onChange,
}: {
  aspect: RatingAspect;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = hueColors(theme, "muhasabah");
  const label = t(`ibadah.muhasabah.aspect.${aspect}`);
  return (
    <View
      style={styles.rating}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={t(`ibadah.muhasabah.question.${aspect}`)}
      accessibilityValue={{
        min: RATING_MIN,
        max: RATING_MAX,
        now: value ?? undefined,
        text: value ? t("ibadah.muhasabah.rate", { aspect: label, value }) : undefined,
      }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        const current = value ?? 0;
        if (event.nativeEvent.actionName === "increment") {
          onChange(Math.min(RATING_MAX, current + 1));
        } else if (event.nativeEvent.actionName === "decrement") {
          onChange(current <= RATING_MIN ? null : current - 1);
        }
      }}
    >
      <View style={styles.ratingHead}>
        <Text style={styles.emoji}>{value ? RATING_EMOJI[aspect][value - 1] : "·"}</Text>
        <Text style={[typography.title, tabular, { color: value ? colors.base : theme.faint }]}>
          {value ?? "–"}
          <Text style={[typography.subhead, { color: theme.faint }]}> / {RATING_MAX}</Text>
        </Text>
        {value ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t("ibadah.muhasabah.clearRating")}
            onPress={() => onChange(null)}
            hitSlop={10}
            style={styles.clear}
          >
            <Ionicons name="close-circle" size={20} color={theme.faint} />
          </PressableScale>
        ) : null}
      </View>
      <View style={styles.stops}>
        {RATINGS.map((n) => {
          const on = value !== null && n <= value;
          return (
            <PressableScale
              key={n}
              importantForAccessibility="no"
              accessibilityElementsHidden
              onPress={() => onChange(n)}
              scaleTo={0.9}
              hitSlop={{ top: 6, bottom: 6 }}
              style={[
                styles.stop,
                {
                  backgroundColor: on ? colors.base : theme.surfaceAlt,
                  borderColor: n === value ? theme.text : on ? colors.base : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  typography.caption,
                  tabular,
                  { color: on ? theme.surface : theme.muted, fontWeight: "700" },
                ]}
              >
                {n}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      <View style={styles.ends}>
        <Text style={[typography.caption, { color: theme.muted }]}>
          {t(`ibadah.muhasabah.low.${aspect}`)}
        </Text>
        <Text style={[typography.caption, { color: theme.muted }]}>
          {t(`ibadah.muhasabah.high.${aspect}`)}
        </Text>
      </View>
    </View>
  );
}

/** A month of days, Monday first; days with notes carry a dot in the muhasabah colour. Future days are disabled. */
export function MonthCalendar({
  year,
  month,
  today,
  written,
  onPrev,
  onNext,
  onPick,
}: {
  year: number;
  month: number;
  today: DayKey;
  written: ReadonlySet<DayKey>;
  onPrev: () => void;
  onNext: () => void;
  onPick: (day: DayKey) => void;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const colors = hueColors(theme, "muhasabah");
  const weeks = monthWeeks(year, month);
  const title = new Intl.DateTimeFormat(i18n.language, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 15)));
  // 1 Jan 2024 was a Monday.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(i18n.language, { weekday: "narrow", timeZone: "UTC" }).format(
      new Date(Date.UTC(2024, 0, 1 + i, 12)),
    ),
  );
  const thisMonth = today.slice(0, 7) === `${year}-${String(month).padStart(2, "0")}`;
  return (
    <View style={styles.calendar}>
      <View style={styles.calendarHead}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t("ibadah.muhasabah.prevMonth")}
          onPress={onPrev}
          hitSlop={6}
          style={styles.arrow}
        >
          <Ionicons name="chevron-back" size={20} color={theme.text} />
        </PressableScale>
        <Text accessibilityRole="header" style={[typography.headline, { color: theme.text }]}>
          {title}
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t("ibadah.muhasabah.nextMonth")}
          accessibilityState={{ disabled: thisMonth }}
          disabled={thisMonth}
          onPress={onNext}
          hitSlop={6}
          style={styles.arrow}
        >
          <Ionicons name="chevron-forward" size={20} color={theme.text} />
        </PressableScale>
      </View>
      <View style={styles.week}>
        {weekdays.map((name, i) => (
          <Text key={i} style={[typography.caption, styles.weekday, { color: theme.faint }]}>
            {name}
          </Text>
        ))}
      </View>
      {weeks.map((week, w) => (
        <View key={w} style={styles.week}>
          {week.map((day, i) => {
            if (!day) return <View key={i} style={styles.cell} />;
            const future = day > today;
            const has = written.has(day);
            const isToday = day === today;
            const label = formatDay(day, i18n.language);
            return (
              <PressableScale
                key={day}
                accessibilityRole="button"
                accessibilityLabel={
                  has
                    ? t("ibadah.muhasabah.dayLabel", { day: label })
                    : t("ibadah.muhasabah.dayEmpty", { day: label })
                }
                accessibilityState={{ disabled: future }}
                disabled={future}
                onPress={() => onPick(day)}
                scaleTo={0.9}
                style={styles.cell}
              >
                <View
                  style={[
                    styles.day,
                    has ? { backgroundColor: colors.soft } : null,
                    isToday ? { borderColor: colors.base, borderWidth: 1.5 } : null,
                  ]}
                >
                  <Text
                    style={[
                      typography.subhead,
                      tabular,
                      {
                        color: future ? theme.faint : has ? colors.base : theme.text,
                        fontWeight: has || isToday ? "700" : "400",
                      },
                    ]}
                  >
                    {Number(day.slice(8))}
                  </Text>
                </View>
                <View
                  style={[styles.dot, { backgroundColor: has ? colors.base : "transparent" }]}
                />
              </PressableScale>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Daily mean ratings as bars (a faint stub for a day without ratings), then the mean per aspect. */
export function TrendChart({
  trend,
  summary,
}: {
  trend: readonly TrendDay[];
  summary: TrendSummary;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = hueColors(theme, "muhasabah");
  const format = (n: number) => n.toFixed(1);
  return (
    <View style={styles.trend}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={t("ibadah.muhasabah.chartLabel")}
        style={styles.bars}
      >
        {trend.map((day) => (
          <View key={day.date} style={styles.barSlot}>
            <View
              style={[
                styles.bar,
                day.average === null
                  ? { height: 3, backgroundColor: theme.surfaceAlt }
                  : {
                      height: Math.max(6, (day.average / RATING_MAX) * 96),
                      backgroundColor: colors.base,
                    },
              ]}
            />
          </View>
        ))}
      </View>
      {summary.average === null ? (
        <Text style={[typography.subhead, { color: theme.muted }]}>
          {t("ibadah.muhasabah.noRatings")}
        </Text>
      ) : (
        <>
          <View style={styles.figure}>
            <Text style={[typography.subhead, styles.grow, { color: theme.muted }]}>
              {t("ibadah.muhasabah.average")}
            </Text>
            <Text style={[typography.title, tabular, { color: colors.base }]}>
              {format(summary.average)}
            </Text>
          </View>
          {summary.change !== null ? (
            <Text style={[typography.footnote, { color: theme.muted }]}>
              {Math.abs(summary.change) < 0.05
                ? t("ibadah.muhasabah.steady")
                : summary.change > 0
                  ? t("ibadah.muhasabah.up", { value: format(summary.change) })
                  : t("ibadah.muhasabah.down", { value: format(-summary.change) })}
            </Text>
          ) : null}
          {RATING_ASPECTS.map((aspect) => {
            const value = summary.aspects[aspect];
            return (
              <View key={aspect} style={styles.aspect}>
                <Text style={[typography.footnote, styles.aspectLabel, { color: theme.text }]}>
                  {t(`ibadah.muhasabah.aspect.${aspect}`)}
                </Text>
                <View style={styles.grow}>
                  <ProgressTrack
                    value={value === null ? 0 : value / RATING_MAX}
                    fill={colors.base}
                    track={theme.surfaceAlt}
                    height={6}
                  />
                </View>
                <Text
                  style={[typography.footnote, tabular, styles.aspectValue, { color: theme.muted }]}
                >
                  {value === null ? "–" : format(value)}
                </Text>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  rating: { gap: spacing.sm },
  ratingHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  emoji: { fontSize: 26, width: 34, textAlign: "center" },
  clear: { marginLeft: "auto" },
  stops: { flexDirection: "row", gap: 4 },
  stop: {
    flex: 1,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ends: { flexDirection: "row", justifyContent: "space-between" },
  calendar: { gap: 4 },
  calendarHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  arrow: { width: HIT - 4, height: HIT - 4, alignItems: "center", justifyContent: "center" },
  week: { flexDirection: "row" },
  cell: { flex: 1, alignItems: "center", paddingVertical: 2 },
  weekday: { flex: 1, textAlign: "center", paddingVertical: 2 },
  day: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderColor: "transparent",
    borderWidth: 1.5,
  },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  trend: { gap: spacing.sm },
  bars: { flexDirection: "row", alignItems: "flex-end", height: 100, gap: 2 },
  barSlot: { flex: 1, justifyContent: "flex-end" },
  bar: { borderRadius: 2 },
  figure: { flexDirection: "row", alignItems: "center" },
  aspect: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  aspectLabel: { width: 72 },
  aspectValue: { width: 32, textAlign: "right" },
});
