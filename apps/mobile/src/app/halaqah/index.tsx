import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, IconChip } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { Button, Hint, ProgressBar } from "@/ramadhan/components/fields";
import { radius, spacing, tabular, typography, useTheme } from "@/theme";
import { DayList } from "@/halaqah/components/DayList";
import { NudgeSettings } from "@/halaqah/components/NudgeSettings";
import { SessionView, useLang } from "@/halaqah/components/SessionView";
import { halaqahAvailable } from "@/halaqah/bundled";
import { dayOf } from "@/halaqah/program";
import { nextUncompletedDay } from "@/halaqah/schedule";
import { useHalaqahProgress, useHalaqahToday } from "@/halaqah/useHalaqah";

/**
 * During Ramadhan: today's talk, then every day for catch-up. Outside Ramadhan: the program
 * preview with "start early", which opens the first talk not yet done.
 */
export default function HalaqahScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const lang = useLang();
  const today = useHalaqahToday();
  const done = useHalaqahProgress(today?.program.id ?? "");
  if (!halaqahAvailable())
    return (
      <Text style={[styles.unavailable, { color: theme.muted }]}>{t("halaqah.unavailable")}</Text>
    );
  if (!today || !done) return null;

  const { program, position, todayKey } = today;
  const todayDay = position.kind === "during" ? dayOf(program, position.day) : null;
  const next = nextUncompletedDay(new Set(done.keys()), program.totalDays);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
    >
      <Card>
        <View style={styles.head}>
          <IconChip icon="school" size={48} color={theme.gold} background={theme.goldSoft} />
          <View style={styles.grow}>
            <Text style={[typography.title, { color: theme.text }]}>{program.title[lang]}</Text>
            {position.kind === "before" ? (
              <Text style={[typography.subhead, tabular, { color: theme.muted }]}>
                {position.daysUntil === null
                  ? t("halaqah.forYear", { year: program.hijriYear })
                  : t("halaqah.beforeRamadhan", { count: position.daysUntil })}
              </Text>
            ) : null}
            {position.kind === "after" ? (
              <Text style={[typography.subhead, tabular, { color: theme.muted }]}>
                {t("halaqah.afterRamadhan", { year: program.hijriYear })}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.figureRow}>
          <Text style={[styles.figure, tabular, { color: theme.countdown }]}>
            {done.size}
            <Text style={[styles.total, { color: theme.muted }]}>/{program.totalDays}</Text>
          </Text>
          <View style={styles.grow}>
            <Hint>{t("halaqah.progress", { done: done.size, total: program.totalDays })}</Hint>
          </View>
        </View>
        <ProgressBar fraction={done.size / program.totalDays} />
        {!todayDay && next !== null ? (
          <View style={styles.start}>
            <Button
              label={
                done.size === 0 ? t("halaqah.startEarly") : t("halaqah.continueFrom", { day: next })
              }
              onPress={() => router.push({ pathname: "/halaqah/[day]", params: { day: next } })}
            />
            <Hint>{t("halaqah.openAnyTime")}</Hint>
          </View>
        ) : null}
      </Card>

      {todayDay ? (
        <SessionView
          key={todayDay.day}
          program={program}
          day={todayDay}
          done={done.has(todayDay.day)}
          todayKey={todayKey}
        />
      ) : next === null ? (
        <View style={[styles.banner, { backgroundColor: theme.accentSoft }]}>
          <IconChip icon="checkmark-done" color={theme.accentText} background={theme.accent} />
          <Text
            style={[typography.callout, styles.grow, { color: theme.accent, fontWeight: "600" }]}
          >
            {t("halaqah.allDone")}
          </Text>
        </View>
      ) : null}

      <View style={styles.allDays}>
        <Text accessibilityRole="header" style={[typography.title, { color: theme.text }]}>
          {t("halaqah.allDays")}
        </Text>
        <Hint>{t("halaqah.catchUp")}</Hint>
      </View>
      <DayList
        program={program}
        done={done}
        today={position.kind === "during" ? position.day : null}
      />

      <NudgeSettings />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  unavailable: { padding: spacing.lg },
  content: { paddingHorizontal: spacing.md + 4, paddingTop: spacing.sm, gap: spacing.lg },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md - 4 },
  grow: { flex: 1, gap: 2 },
  figureRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm },
  figure: { fontSize: 40, fontWeight: "800", letterSpacing: -0.8 },
  total: { fontSize: 20, fontWeight: "700", letterSpacing: 0 },
  start: { gap: spacing.sm, marginTop: spacing.sm },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 4,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  allDays: { gap: spacing.xs, paddingHorizontal: spacing.xs, marginBottom: -spacing.sm },
});
