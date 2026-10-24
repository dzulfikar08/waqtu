import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";

import { useTranslation } from "@/i18n";
import { spacing, useTheme } from "@/theme";
import { SessionView } from "@/halaqah/components/SessionView";
import { dayOf } from "@/halaqah/program";
import { useHalaqahProgress, useHalaqahToday } from "@/halaqah/useHalaqah";

/** Any single program day: catch-up on a past day, or reading ahead. */
export default function HalaqahDayScreen() {
  const { day: param } = useLocalSearchParams<{ day: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const today = useHalaqahToday();
  const done = useHalaqahProgress(today?.program.id ?? "");
  if (!today || !done) return null;

  const entry = dayOf(today.program, Number(param));
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {entry ? (
        <SessionView
          key={entry.day}
          program={today.program}
          day={entry}
          done={done.has(entry.day)}
          todayKey={today.todayKey}
        />
      ) : (
        <Text style={{ color: theme.muted }}>{t("halaqah.notFound")}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: spacing.md, gap: spacing.lg } });
