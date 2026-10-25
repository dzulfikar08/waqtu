import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useTranslation } from "@/i18n";
import { Button, Hint, ProgressBar } from "@/ramadhan/components/fields";
import { spacing, useTheme } from "@/theme";
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
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>{program.title[lang]}</Text>
        {position.kind === "before" ? (
          <Text style={{ color: theme.muted }}>
            {position.daysUntil === null
              ? t("halaqah.forYear", { year: program.hijriYear })
              : t("halaqah.beforeRamadhan", { count: position.daysUntil })}
          </Text>
        ) : null}
        {position.kind === "after" ? (
          <Text style={{ color: theme.muted }}>
            {t("halaqah.afterRamadhan", { year: program.hijriYear })}
          </Text>
        ) : null}
        <ProgressBar fraction={done.size / program.totalDays} />
        <Hint>{t("halaqah.progress", { done: done.size, total: program.totalDays })}</Hint>
      </View>

      {todayDay ? (
        <SessionView
          key={todayDay.day}
          program={program}
          day={todayDay}
          done={done.has(todayDay.day)}
          todayKey={todayKey}
        />
      ) : next !== null ? (
        <View style={styles.header}>
          <Button
            label={
              done.size === 0 ? t("halaqah.startEarly") : t("halaqah.continueFrom", { day: next })
            }
            onPress={() => router.push({ pathname: "/halaqah/[day]", params: { day: next } })}
          />
          <Hint>{t("halaqah.openAnyTime")}</Hint>
        </View>
      ) : (
        <Text style={{ color: theme.accent, fontWeight: "600" }}>{t("halaqah.allDone")}</Text>
      )}

      <View style={styles.header}>
        <Text style={[styles.heading, { color: theme.text }]}>{t("halaqah.allDays")}</Text>
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
  content: { padding: spacing.md, gap: spacing.lg },
  header: { gap: spacing.sm, paddingHorizontal: spacing.sm },
  title: { fontSize: 24, fontWeight: "700" },
  heading: { fontSize: 20, fontWeight: "700" },
});
