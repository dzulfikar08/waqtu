import { useRouter } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { Button, Hint, Panel } from "@/ramadhan/components/fields";
import { spacing, useTheme } from "@/theme";
import { dayOf } from "../program";
import { useHalaqahProgress, useHalaqahToday } from "../useHalaqah";
import { useLang } from "./SessionView";

/**
 * Ramadhan-tab entry to the halaqah: today's talk during Ramadhan, otherwise the program with
 * "start early". Opens the full screen.
 */
export function HalaqahCard() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const lang = useLang();
  const today = useHalaqahToday();
  const done = useHalaqahProgress(today?.program.id ?? "");
  if (!today || !done) return null;

  const { program, position } = today;
  const day = position.kind === "during" ? dayOf(program, position.day) : null;
  return (
    <Section title={t("halaqah.title")}>
      <Panel>
        {day ? (
          <>
            <Text style={{ color: theme.accent, fontWeight: "600" }}>
              {t("halaqah.dayN", { day: day.day })}
            </Text>
            <Text style={[styles.title, { color: theme.text }]}>{day.title[lang]}</Text>
            <Hint>{t("halaqah.progress", { done: done.size, total: program.totalDays })}</Hint>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: theme.text }]}>{t("halaqah.programTitle")}</Text>
            <Hint>{t("halaqah.openAnyTime")}</Hint>
          </>
        )}
        <Button
          label={day ? t("halaqah.openToday") : t("halaqah.startEarly")}
          onPress={() => router.push("/halaqah")}
        />
      </Panel>
    </Section>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: "700", marginBottom: spacing.xs },
});
