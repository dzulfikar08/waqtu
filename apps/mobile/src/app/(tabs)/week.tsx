import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { itemLabel } from "@/components/itemLabel";
import { Card, Divider, IconChip, Screen, SectionTitle, type IconName } from "@/components/ui";
import { useMutabaah } from "@/hooks/useMutabaah";
import { useTranslation } from "@/i18n";
import { civilOf } from "@/mutabaah/dates";
import { radius, spacing, tabular, typography, useTheme } from "@/theme";

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
  n: number;
}

export default function WeekScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const model = useMutabaah();

  if (!model) {
    return (
      <Screen title={t("week.title")}>
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
    { key: "week.onTime", icon: "time-outline", n: week.fardhOnTime },
    { key: "week.jamaah", icon: "people-outline", n: week.fardhJamaah },
    { key: "week.qadha", icon: "refresh-outline", n: week.fardhQadha },
  ];
  const stats = fardhStats.map((stat) => ({ ...stat, label: labelOf(t(stat.key, { n: MARK })) }));

  return (
    <Screen
      title={t("week.title")}
      caption={
        <Text style={[typography.subhead, tabular, { color: theme.muted }]}>
          {t("week.range", {
            from: dayLabel(first, i18n.language, short),
            to: dayLabel(last, i18n.language, short),
          })}
        </Text>
      }
    >
      <Card>
        <View style={styles.head}>
          <IconChip icon="calendar" size={44} />
          <Text style={[styles.figure, tabular, { color: theme.text }]}>
            {t("week.daysCounted", { count: week.countedDays })}
          </Text>
        </View>
        <View style={styles.bars}>
          {week.days.map((day) => {
            const ratio = day.total > 0 ? Math.min(1, day.done / day.total) : 0;
            const isToday = day.date === today;
            return (
              <View key={day.date} style={styles.barCol}>
                <View style={[styles.barTrack, { backgroundColor: theme.surfaceAlt }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${Math.round(ratio * 100)}%`,
                        backgroundColor: day.counted ? theme.accent : theme.secondary,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    typography.caption,
                    isToday
                      ? { color: theme.accent, fontWeight: "800" }
                      : { color: theme.muted, fontWeight: "600" },
                  ]}
                >
                  {dayLabel(day.date, i18n.language, { weekday: "narrow" })}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={[typography.subhead, styles.message, { color: theme.muted }]}>{message}</Text>
      </Card>

      {week.fardhEnabled > 0 ? (
        <View style={styles.section}>
          <SectionTitle title={t("week.fardh")} icon="moon-outline" />
          <Card>
            <Text style={[typography.headline, tabular, { color: theme.text }]}>
              {t("week.fardhDone", { done: week.fardhDone, total: fardhTotal })}
            </Text>
            <View style={[styles.track, { backgroundColor: theme.surfaceAlt }]}>
              <View
                style={[
                  styles.trackFill,
                  {
                    backgroundColor: theme.accent,
                    width: `${Math.round(Math.min(1, week.fardhDone / fardhTotal) * 100)}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.tiles}>
              {stats.map((stat) => (
                <View
                  key={stat.key}
                  accessible
                  accessibilityLabel={t(stat.key, { n: stat.n })}
                  style={[styles.tile, { backgroundColor: theme.surfaceAlt }]}
                >
                  <IconChip icon={stat.icon} size={28} />
                  <Text style={[styles.tileFigure, tabular, { color: theme.text }]}>{stat.n}</Text>
                  <Text style={[typography.caption, { color: theme.muted }]} numberOfLines={2}>
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </View>
      ) : null}

      {byId.has("tilawah") ? (
        <View style={styles.section}>
          <SectionTitle title={t("items.tilawah")} icon="book-outline" />
          <Card>
            <View style={styles.head}>
              <IconChip icon="book" color={theme.gold} background={theme.goldSoft} size={40} />
              <Text style={[typography.headline, tabular, styles.grow, { color: theme.text }]}>
                {t("week.pages", { n: week.pages })}
              </Text>
            </View>
          </Card>
        </View>
      ) : null}

      {top.length > 0 || week.bestDay ? (
        <View style={styles.section}>
          <SectionTitle title={t("week.top")} icon="star-outline" />
          <Card padded={false}>
            {top.map(({ entry, item }, index) => (
              <View key={entry.id}>
                {index > 0 ? <Divider inset={spacing.md + 30 + spacing.md - 4} /> : null}
                <View style={styles.row}>
                  <IconChip icon="checkmark-done" size={30} />
                  <Text style={[typography.body, styles.grow, { color: theme.text }]}>
                    {itemLabel(item, t)}
                  </Text>
                  <Text
                    style={[typography.callout, tabular, styles.strong, { color: theme.muted }]}
                  >
                    {t("week.daysDone", { n: entry.daysDone })}
                  </Text>
                </View>
              </View>
            ))}
            {week.bestDay ? (
              <View>
                {top.length > 0 ? <Divider /> : null}
                <View style={[styles.row, { backgroundColor: theme.goldSoft }]}>
                  <Ionicons
                    name="trophy"
                    size={18}
                    color={theme.gold}
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

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md - 4 },
  grow: { flex: 1 },
  strong: { fontWeight: "600" },
  figure: { flex: 1, fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  message: { lineHeight: 20 },
  bars: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    height: 120,
    marginTop: spacing.sm,
  },
  barCol: { flex: 1, alignItems: "center", gap: spacing.xs + 2 },
  barTrack: {
    flex: 1,
    width: "72%",
    borderRadius: radius.sm,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: { width: "100%", borderRadius: radius.sm },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  trackFill: { height: 8, borderRadius: 4 },
  tiles: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  tile: { flex: 1, borderRadius: radius.md, padding: spacing.sm + 4, gap: spacing.xs },
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
