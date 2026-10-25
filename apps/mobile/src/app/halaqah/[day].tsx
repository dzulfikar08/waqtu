import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTranslation } from "@/i18n";
import { spacing, typography, useTheme } from "@/theme";
import { SessionView } from "@/halaqah/components/SessionView";
import { halaqahAvailable } from "@/halaqah/bundled";
import { dayOf } from "@/halaqah/program";
import { useHalaqahProgress, useHalaqahToday } from "@/halaqah/useHalaqah";

/** Any single program day: catch-up on a past day, or reading ahead. */
export default function HalaqahDayScreen() {
  const { day: param } = useLocalSearchParams<{ day: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const today = useHalaqahToday();
  const done = useHalaqahProgress(today?.program.id ?? "");
  if (!halaqahAvailable())
    return (
      <Text style={[styles.unavailable, { color: theme.muted }]}>{t("halaqah.unavailable")}</Text>
    );
  if (!today || !done) return null;

  const entry = dayOf(today.program, Number(param));
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
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
        <Text style={[typography.body, { color: theme.muted }]}>{t("halaqah.notFound")}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md + 4, paddingTop: spacing.sm, gap: spacing.lg },
  unavailable: { padding: spacing.lg },
});
