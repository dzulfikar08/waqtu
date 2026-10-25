import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { hueColors, spacing, tabular, typography, useTheme } from "@/theme";
import type { Program } from "../program";
import { useLang } from "./SessionView";

const BADGE = 36;

/**
 * Every program day grouped by week; any of them opens. Each row leads with the day number in a
 * round violet badge: filled once completed, ringed for today, a soft wash otherwise. Missed days
 * carry nothing.
 */
export function DayList({
  program,
  done,
  today,
}: {
  program: Program;
  done: ReadonlyMap<number, string>;
  /** Program day matching today, when inside Ramadhan. */
  today: number | null;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const violet = hueColors(theme, "halaqah");
  /** The day number on a filled violet badge: white on the deep light-mode violet, dark on the pale dark-mode one. */
  const onViolet = theme.dark ? theme.background : "#FFFFFF";
  const lang = useLang();
  return (
    <>
      {program.phases.map((phase) => (
        <Section key={phase.id} title={phase.title[lang]} icon="calendar-outline" hue="halaqah">
          {program.days
            .filter((d) => d.day >= phase.from && d.day <= phase.to)
            .map((d) => {
              const finished = done.has(d.day);
              const isToday = d.day === today;
              const dayLine = `${t("halaqah.dayN", { day: d.day })}${isToday ? ` · ${t("halaqah.today")}` : ""}`;
              return (
                <Pressable
                  key={d.day}
                  accessibilityRole="button"
                  accessibilityLabel={`${dayLine}, ${d.title[lang]}${finished ? `, ${t("halaqah.done")}` : ""}`}
                  onPress={() =>
                    router.push({ pathname: "/halaqah/[day]", params: { day: d.day } })
                  }
                  style={({ pressed }) => [
                    styles.row,
                    {
                      borderColor: theme.separator,
                      backgroundColor: pressed ? violet.soft : "transparent",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: finished ? violet.base : violet.soft,
                        borderColor: isToday ? violet.base : "transparent",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeNumber,
                        tabular,
                        { color: finished ? onViolet : violet.base },
                      ]}
                    >
                      {d.day}
                    </Text>
                  </View>
                  <View style={styles.text}>
                    <Text
                      style={[
                        typography.caption,
                        styles.dayLine,
                        { color: isToday ? violet.base : theme.muted },
                      ]}
                    >
                      {dayLine}
                    </Text>
                    <Text style={[typography.body, { color: theme.text }]}>{d.title[lang]}</Text>
                  </View>
                  {finished ? (
                    <Ionicons name="checkmark-circle" size={20} color={theme.accent} />
                  ) : null}
                  <Ionicons name="chevron-forward" size={18} color={theme.faint} />
                </Pressable>
              );
            })}
        </Section>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 60,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeNumber: { fontSize: 15, fontWeight: "700" },
  text: { flex: 1, gap: 2 },
  dayLine: { fontWeight: "600" },
});
