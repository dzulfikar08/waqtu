import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { spacing, useTheme } from "@/theme";
import type { Program } from "../program";
import { useLang } from "./SessionView";

/** Every program day grouped by week; any of them opens. Completed days carry a check, missed ones carry nothing. */
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
  const lang = useLang();
  return (
    <>
      {program.phases.map((phase) => (
        <Section key={phase.id} title={phase.title[lang]}>
          {program.days
            .filter((d) => d.day >= phase.from && d.day <= phase.to)
            .map((d) => (
              <Pressable
                key={d.day}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: "/halaqah/[day]", params: { day: d.day } })}
                style={[styles.row, { borderColor: theme.border }]}
              >
                <View style={styles.text}>
                  <Text style={{ color: theme.muted, fontSize: 12 }}>
                    {t("halaqah.dayN", { day: d.day })}
                    {d.day === today ? ` · ${t("halaqah.today")}` : ""}
                  </Text>
                  <Text style={{ color: theme.text, fontSize: 16 }}>{d.title[lang]}</Text>
                </View>
                {done.has(d.day) ? (
                  <Text
                    accessibilityLabel={t("halaqah.done")}
                    style={{ color: theme.accent, fontSize: 18 }}
                  >
                    ✓
                  </Text>
                ) : null}
              </Pressable>
            ))}
        </Section>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, gap: 2 },
});
