import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, IconChip, SectionTitle } from "@/components/ui";
import { onDataChanged } from "@/db/events";
import { useMuhasabahCloud } from "@/hooks/useMuhasabahCloud";
import { useMutabaah } from "@/hooks/useMutabaah";
import { useTranslation } from "@/i18n";
import { MonthCalendar, TrendChart } from "@/ibadah/components/Muhasabah";
import {
  averageRating,
  getMuhasabahBetween,
  ratingTrend,
  shiftMonth,
  summarizeTrend,
  type MuhasabahEntry,
} from "@/ibadah/muhasabah";
import { addDays, civilOf, type DayKey } from "@/mutabaah/dates";
import { Button } from "@/ramadhan/components/fields";
import { hueColors, spacing, typography, useTheme } from "@/theme";

const TREND_DAYS = 30;

function monthBounds(year: number, month: number): { from: DayKey; to: DayKey } {
  const mm = String(month).padStart(2, "0");
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, "0")}` };
}

/** Muhasabah: today's reflection, a calendar of past ones and the 30-day trend. Private to this phone unless cloud sync is on. */
export default function MuhasabahScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const model = useMutabaah();
  const cloud = useMuhasabahCloud();
  const today = model?.today;
  const colors = hueColors(theme, "muhasabah");
  const [shown, setShown] = useState<{ year: number; month: number } | null>(null);
  const [entries, setEntries] = useState<MuhasabahEntry[] | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => onDataChanged(() => setVersion((v) => v + 1)), []);

  const month = useMemo(() => {
    if (shown) return shown;
    if (!today) return null;
    const { year, month: m } = civilOf(today);
    return { year, month: m };
  }, [shown, today]);

  useEffect(() => {
    if (!today || !month) return;
    let cancelled = false;
    const bounds = monthBounds(month.year, month.month);
    const trendFrom = addDays(today, -(TREND_DAYS - 1));
    const from = bounds.from < trendFrom ? bounds.from : trendFrom;
    const to = bounds.to > today ? bounds.to : today;
    void getMuhasabahBetween(db, from, to).then((rows) => {
      if (!cancelled) setEntries(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [db, today, month, version]);

  if (!today || !month || !entries) return null;

  const todayEntry = entries.find((entry) => entry.date === today) ?? null;
  const written = new Set(entries.map((entry) => entry.date));
  const trend = ratingTrend(entries, today, TREND_DAYS);
  const summary = summarizeTrend(entries, today, TREND_DAYS);
  const average = todayEntry ? averageRating(todayEntry) : null;
  const open = (day: DayKey) =>
    router.push({ pathname: "/muhasabah/[date]", params: { date: day } });

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
    >
      <Card>
        <View style={styles.row}>
          <IconChip icon="lock-closed" color={colors.base} background={colors.soft} />
          <Text style={[typography.footnote, styles.grow, { color: theme.muted, lineHeight: 18 }]}>
            {t("ibadah.muhasabah.private")}
            {cloud.enabled
              ? `\n${cloud.status === "error" ? t("sync.error") : t("ibadah.muhasabah.synced")}`
              : ""}
          </Text>
        </View>
      </Card>

      <View style={styles.block}>
        <SectionTitle title={t("ibadah.muhasabah.today")} icon="journal" hue="muhasabah" />
        <Card hue="muhasabah">
          {todayEntry ? (
            <>
              {average !== null ? (
                <Text style={[typography.headline, { color: colors.base }]}>
                  {t("ibadah.muhasabah.averageToday", { value: average.toFixed(1) })}
                </Text>
              ) : null}
              {todayEntry.feelings ? (
                <Text numberOfLines={3} style={[typography.body, { color: theme.text }]}>
                  {todayEntry.feelings}
                </Text>
              ) : null}
              <Button
                label={t("ibadah.muhasabah.edit")}
                icon="create-outline"
                tone="plain"
                block
                onPress={() => open(today)}
              />
            </>
          ) : (
            <>
              <View style={styles.row}>
                <Ionicons name="moon-outline" size={20} color={colors.base} />
                <Text style={[typography.subhead, styles.grow, { color: theme.muted }]}>
                  {t("ibadah.muhasabah.cardTodo")}
                </Text>
              </View>
              <Button
                label={t("ibadah.muhasabah.start")}
                icon="create-outline"
                block
                onPress={() => open(today)}
              />
            </>
          )}
        </Card>
      </View>

      <View style={styles.block}>
        <SectionTitle title={t("ibadah.muhasabah.calendar")} icon="calendar" hue="muhasabah" />
        <Card>
          <MonthCalendar
            year={month.year}
            month={month.month}
            today={today}
            written={written}
            onPrev={() => setShown(shiftMonth(month.year, month.month, -1))}
            onNext={() => setShown(shiftMonth(month.year, month.month, 1))}
            onPick={open}
          />
        </Card>
      </View>

      <View style={styles.block}>
        <SectionTitle
          title={t("ibadah.muhasabah.trends")}
          icon="trending-up"
          hue="muhasabah"
          right={
            <Text style={[typography.caption, { color: theme.muted }]}>
              {t("ibadah.muhasabah.daysWritten", { count: summary.daysWritten })}
            </Text>
          }
        />
        <Card>
          <TrendChart trend={trend} summary={summary} />
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md + 4, paddingTop: spacing.md, gap: spacing.lg },
  block: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md - 4 },
  grow: { flex: 1 },
});
