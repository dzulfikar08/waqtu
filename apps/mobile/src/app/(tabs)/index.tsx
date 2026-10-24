import { ScrollView, StyleSheet, Text } from "react-native";

import { formatHijri } from "@/lib/hijri";
import { useTranslation } from "@/i18n";
import { spacing, useTheme } from "@/theme";

export default function TodayScreen() {
  const { i18n } = useTranslation();
  const theme = useTheme();
  const now = new Date();
  const gregorian = new Intl.DateTimeFormat(i18n.language, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  const hijri = formatHijri(now, i18n.language);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.date, { color: theme.text }]}>{gregorian}</Text>
      {hijri ? <Text style={[styles.hijri, { color: theme.accent }]}>{hijri}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.sm },
  date: { fontSize: 24, fontWeight: "700" },
  hijri: { fontSize: 18, fontWeight: "600" },
});
