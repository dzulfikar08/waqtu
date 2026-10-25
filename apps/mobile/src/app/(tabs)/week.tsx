import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { itemLabel } from "@/components/itemLabel";
import {
  Card,
  Divider,
  IconChip,
  ProgressTrack,
  Screen,
  SectionTitle,
  type IconName,
} from "@/components/ui";
import { useMutabaah } from "@/hooks/useMutabaah";
import { useTranslation } from "@/i18n";
import { civilOf, type DayKey } from "@/mutabaah/dates";
import type { DaySummary } from "@/mutabaah/week";
import {
  hueColors,
  hueWash,
  onSky,
  radius,
  spacing,
  tabular,
  typography,
  useTheme,
  type Hue,
} from "@/theme";

function dayLabel(day: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  const { year, month, day: d } = civilOf(day);
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, d, 12)),
  );
}

/** Marker swapped in for a count so the label around it ("On time: {{n}}") can be shown apart. */
const MARK = "§";

/** The words of a "Label: {{n}}" string without the count, e.g. "On time". */
function labelOf(formatted: string): string {
  const [before = "", after = ""] = formatted.split(MARK);
  return (before.trim() || after.trim()).replace(/^[\s:]+|[\s:]+$/g, "");
}

interface FardhStat {
  key: "week.onTime" | "week.jamaah" | "week.qadha";
  icon: IconName;
  hue: Hue;
  n: number;
}

/** The hero's indigo to violet gradient: [light, dark]; dark is the same, dimmed. */
const HERO: readonly [readonly [string, string], readonly [string, string]] = [
  ["#4F5BD5", "#7C4DCC"],
  ["#232A66", "#3A2766"],
];

export default function WeekScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const model = useMutabaah();
  const indigo = hueColors(theme, "week");
  const backdrop = hueWash(theme, "week");

  if (!model) {
    return (
      <Screen title={t("week.title")} backdrop={backdrop}>
        <Text style={[typography.body, { color: theme.muted }]}>{t("today.loading")}</Text>
      </Screen>
    );
  }

  const { week, items, today } = model;
  const first = week.days[0].date;
  const last = week.days[week.days.length - 1].date;
  const short: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const fardhTotal = week.fardhEnabled * 7;
  const byId = new Map(items.map((item) => [item.id, item]));
  const message =
    week.countedDays >= 5 ? t("week.high") : week.countedDays >= 2 ? t("week.mid") : t("week.low");
  const top = week.items
    .filter((entry) => entry.daysDone > 0)
    .slice(0, 5)
    .flatMap((entry) => {
      const item = byId.get(entry.id);
      return item ? [{ entry, item }] : [];
    });
  const fardhStats: FardhStat[] = [
    { key: "week.onTime", icon: "time-outline", hue: "brand", n: week.fardhOnTime },
    { key: "week.jamaah", icon: "people-outline", hue: "prayer", n: week.fardhJamaah },
    { key: "week.qadha", icon: "refresh-outline", hue: "streak", n: week.fardhQadha },
  ];
  const stats = fardhStats.map((stat) => ({ ...stat, label: labelOf(t(stat.key, { n: MARK })) }));
  const prayer = hueColors(theme, "prayer");
  const hafalan = hueColors(theme, "hafalan");
  const best = hueColors(theme, "streak");

  return (
    <Screen
      title={t("week.title")}
      backdrop={backdrop}
      caption={
        <Text style={[typography.subhead, tabular, { color: theme.muted }]}>
          {t("week.range", {
            from: dayLabel(first, i18n.language, short),
            to: dayLabel(last, i18n.language, short),
          })}
        </Text>
      }
    >
      <WeekHero
        days={week.days}
        today={today}
        figure={t("week.daysCounted", { count: week.countedDays })}
        message={message}
      />

      {week.fardhEnabled > 0 ? (
        <View style={styles.section}>
          <SectionTitle title={t("week.fardh")} icon="moon-outline" hue="prayer" />
          <Card hue="prayer">
            <Text style={[typography.headline, tabular, { color: theme.text }]}>
              {t("week.fardhDone", { done: week.fardhDone, total: fardhTotal })}
            </Text>
            <ProgressTrack
              value={week.fardhDone / fardhTotal}
              fill={`linear-gradient(90deg, ${prayer.base} 0%, ${indigo.base} 100%)`}
              track={prayer.soft}
            />
            <View style={styles.tiles}>
              {stats.map((stat) => {
                const hue = hueColors(theme, stat.hue);
                return (
                  <View
                    key={stat.key}
                    accessible
                    accessibilityLabel={t(stat.key, { n: stat.n })}
                    style={[
                      styles.tile,
                      {
                        backgroundColor: theme.surface,
                        borderColor: hue.soft,
                        experimental_backgroundImage: `linear-gradient(160deg, ${hue.soft} 0%, ${hue.wash} 100%)`,
                      },
                    ]}
                  >
                    <IconChip icon={stat.icon} size={28} color={hue.base} background={hue.soft} />
                    <Text style={[styles.tileFigure, tabular, { color: theme.text }]}>
                      {stat.n}
                    </Text>
                    <Text style={[typography.caption, { color: theme.muted }]} numberOfLines={2}>
                      {stat.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>
        </View>
      ) : null}

      {byId.has("tilawah") ? (
        <View style={styles.section}>
          <SectionTitle title={t("items.tilawah")} icon="book-outline" hue="hafalan" />
          <Card hue="hafalan">
            <View style={styles.head}>
              <View
                style={[
                  styles.badge,
                  {
                    experimental_backgroundImage: `radial-gradient(circle, ${hafalan.soft} 0%, ${hafalan.wash} 100%)`,
                  },
                ]}
              >
                <Ionicons
                  name="book"
                  size={22}
                  color={hafalan.base}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              </View>
              <Text style={[typography.headline, tabular, styles.grow, { color: theme.text }]}>
                {t("week.pages", { n: week.pages })}
              </Text>
            </View>
          </Card>
        </View>
      ) : null}

      {top.length > 0 || week.bestDay ? (
        <View style={styles.section}>
          <SectionTitle title={t("week.top")} icon="star-outline" hue="week" />
          <Card padded={false} hue="week">
            {top.map(({ entry, item }, index) => (
              <View key={entry.id}>
                {index > 0 ? <Divider inset={spacing.md + 30 + spacing.md - 4} /> : null}
                <View style={styles.row}>
                  <IconChip
                    icon="checkmark-done"
                    size={30}
                    color={indigo.base}
                    background={indigo.soft}
                  />
                  <Text style={[typography.body, styles.grow, { color: theme.text }]}>
                    {itemLabel(item, t)}
                  </Text>
                  <Text
                    style={[typography.callout, tabular, styles.strong, { color: indigo.base }]}
                  >
                    {t("week.daysDone", { n: entry.daysDone })}
                  </Text>
                </View>
              </View>
            ))}
            {week.bestDay ? (
              <View>
                {top.length > 0 ? <Divider /> : null}
                <View style={[styles.row, { backgroundColor: best.soft }]}>
                  <Ionicons
                    name="trophy"
                    size={18}
                    color={best.base}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                  <Text
                    style={[typography.subhead, styles.grow, styles.strong, { color: theme.text }]}
                  >
                    {t("week.bestDay", {
                      day: dayLabel(week.bestDay, i18n.language, {
                        weekday: "long",
                        day: "numeric",
                        month: "short",
                      }),
                    })}
                  </Text>
                </View>
              </View>
            ) : null}
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}

/**
 * The week at a glance on an indigo to violet card: days recorded and one bar per day, white on frosted tracks, that
 * grow up from the bottom one after another when the card appears; today's bar and weekday are lit.
 */
function WeekHero({
  days,
  today,
  figure,
  message,
}: {
  days: readonly DaySummary[];
  today: DayKey;
  figure: string;
  message: string;
}) {
  const { i18n } = useTranslation();
  const theme = useTheme();
  const [grow] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const run = Animated.timing(grow, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [grow]);
  const [from, to] = HERO[theme.dark ? 1 : 0];
  const step = 0.4 / Math.max(1, days.length - 1);
  return (
    <View
      style={[
        styles.hero,
        {
          experimental_backgroundImage: `linear-gradient(150deg, ${from} 0%, ${to} 100%)`,
          boxShadow: theme.dark
            ? "0 10px 24px -12px rgba(0,0,0,0.6)"
            : `0 14px 28px -14px ${HERO[0][0]}`,
        },
      ]}
    >
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
                "radial-gradient(circle at center, rgba(214,222,255,0.42) 0%, rgba(255,255,255,0) 68%)",
            },
          ]}
        />
        <View style={[styles.ring, styles.ringOuter]} />
        <View style={[styles.ring, styles.ringInner]} />
      </View>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: onSky.glassStrong }]}>
          <Ionicons
            name="calendar"
            size={22}
            color={onSky.text}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </View>
        <Text style={[styles.figure, tabular, { color: onSky.text }]}>{figure}</Text>
      </View>
      <View style={styles.bars}>
        {days.map((day, index) => {
          const ratio = day.total > 0 ? Math.min(1, day.done / day.total) : 0;
          const isToday = day.date === today;
          const start = index * step;
          return (
            <View key={day.date} style={styles.barCol}>
              <View
                style={[
                  styles.barTrack,
                  isToday
                    ? { backgroundColor: onSky.glassStrong, borderColor: onSky.text }
                    : { backgroundColor: onSky.glass, borderColor: "transparent" },
                ]}
              >
                <Animated.View
                  style={[
                    styles.barFill,
                    {
                      height: `${Math.round(ratio * 100)}%`,
                      backgroundColor: day.counted ? onSky.text : onSky.faint,
                      transformOrigin: "bottom",
                      transform: [
                        {
                          scaleY: grow.interpolate({
                            inputRange: [start, start + 0.6],
                            outputRange: [0, 1],
                            extrapolate: "clamp",
                          }),
                        },
                      ],
                    },
                  ]}
                />
              </View>
              <View style={[styles.dayLabel, isToday ? { backgroundColor: onSky.text } : null]}>
                <Text
                  style={[
                    typography.caption,
                    isToday
                      ? { color: from, fontWeight: "800" }
                      : { color: onSky.muted, fontWeight: "600" },
                  ]}
                >
                  {dayLabel(day.date, i18n.language, { weekday: "narrow" })}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      <Text style={[typography.subhead, styles.message, { color: onSky.muted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md - 4 },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  grow: { flex: 1 },
  strong: { fontWeight: "600" },
  hero: {
    borderRadius: radius.lg + 4,
    padding: spacing.md + 4,
    gap: spacing.sm,
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    width: 260,
    height: 260,
    top: -120,
    right: -100,
    borderRadius: 130,
  },
  ring: { position: "absolute", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  ringOuter: { width: 210, height: 210, borderRadius: 105, top: -96, right: -74 },
  ringInner: { width: 150, height: 150, borderRadius: 75, top: -66, right: -44 },
  figure: { flex: 1, fontSize: 24, fontWeight: "800", letterSpacing: -0.3 },
  message: { lineHeight: 20 },
  bars: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    height: 132,
    marginTop: spacing.sm,
  },
  barCol: { flex: 1, alignItems: "center", gap: spacing.xs + 2 },
  barTrack: {
    flex: 1,
    width: "72%",
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: { width: "100%", borderRadius: radius.sm },
  dayLabel: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  tiles: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  tile: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm + 4,
    gap: spacing.xs,
  },
  tileFigure: { fontSize: 24, fontWeight: "800", letterSpacing: -0.3 },
  row: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 4,
  },
});
