import { ScrollView, StyleSheet, Text, View } from "react-native";

import { itemLabel } from "@/components/itemLabel";
import { Section } from "@/components/ui";
import { useMutabaah } from "@/hooks/useMutabaah";
import { useTranslation } from "@/i18n";
import { civilOf } from "@/mutabaah/dates";
import { radius, spacing, useTheme } from "@/theme";

function dayLabel(day: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  const { year, month, day: d } = civilOf(day);
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, d, 12)),
  );
}

export default function WeekScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const model = useMutabaah();

  if (!model) {
    return (
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
      >
        <Text style={{ color: theme.muted }}>{t("today.loading")}</Text>
      </ScrollView>
    );
  }

  const { week, items } = model;
  const first = week.days[0].date;
  const last = week.days[week.days.length - 1].date;
  const short: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const fardhTotal = week.fardhEnabled * 7;
  const byId = new Map(items.map((item) => [item.id, item]));
  const message =
    week.countedDays >= 5 ? t("week.high") : week.countedDays >= 2 ? t("week.mid") : t("week.low");

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: theme.text }]}>{t("week.title")}</Text>
      <Text style={{ color: theme.muted }}>
        {t("week.range", {
          from: dayLabel(first, i18n.language, short),
          to: dayLabel(last, i18n.language, short),
        })}
      </Text>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.bars}>
          {week.days.map((day) => {
            const ratio = day.total > 0 ? Math.min(1, day.done / day.total) : 0;
            return (
              <View key={day.date} style={styles.barCol}>
                <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
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
                <Text style={{ color: theme.muted, fontSize: 12 }}>
                  {dayLabel(day.date, i18n.language, { weekday: "narrow" })}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: "600" }}>
          {t("week.daysCounted", { count: week.countedDays })}
        </Text>
        <Text style={{ color: theme.muted }}>{message}</Text>
      </View>

      {week.fardhEnabled > 0 ? (
        <Section title={t("week.fardh")}>
          <View style={styles.stats}>
            <Text style={{ color: theme.text, fontSize: 16 }}>
              {t("week.fardhDone", { done: week.fardhDone, total: fardhTotal })}
            </Text>
            <Text style={{ color: theme.muted }}>{t("week.onTime", { n: week.fardhOnTime })}</Text>
            <Text style={{ color: theme.muted }}>{t("week.jamaah", { n: week.fardhJamaah })}</Text>
            <Text style={{ color: theme.muted }}>{t("week.qadha", { n: week.fardhQadha })}</Text>
          </View>
        </Section>
      ) : null}

      {byId.has("tilawah") ? (
        <Section title={t("items.tilawah")}>
          <View style={styles.stats}>
            <Text style={{ color: theme.text, fontSize: 16 }}>
              {t("week.pages", { n: week.pages })}
            </Text>
          </View>
        </Section>
      ) : null}

      <Section title={t("week.top")}>
        <View style={styles.stats}>
          {week.items
            .filter((entry) => entry.daysDone > 0)
            .slice(0, 5)
            .map((entry) => {
              const item = byId.get(entry.id);
              return item ? (
                <View key={entry.id} style={styles.line}>
                  <Text style={{ color: theme.text, fontSize: 16, flexShrink: 1 }}>
                    {itemLabel(item, t)}
                  </Text>
                  <Text style={{ color: theme.muted }}>
                    {t("week.daysDone", { n: entry.daysDone })}
                  </Text>
                </View>
              ) : null;
            })}
          {week.bestDay ? (
            <Text style={{ color: theme.muted }}>
              {t("week.bestDay", {
                day: dayLabel(week.bestDay, i18n.language, {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                }),
              })}
            </Text>
          ) : null}
        </View>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 24, fontWeight: "700" },
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  bars: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, height: 96 },
  barCol: { flex: 1, alignItems: "center", gap: spacing.xs },
  barTrack: {
    flex: 1,
    width: "70%",
    borderRadius: radius.md,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: { width: "100%", borderRadius: radius.md },
  stats: { padding: spacing.md, gap: spacing.xs },
  line: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
});
