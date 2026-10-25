import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Card, IconChip, ProgressTrack, SectionTitle } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { Button } from "@/ramadhan/components/fields";
import { hueColors, spacing, tabular, typography, useTheme } from "@/theme";
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
  const violet = hueColors(theme, "halaqah");
  const lang = useLang();
  const today = useHalaqahToday();
  const done = useHalaqahProgress(today?.program.id ?? "");
  if (!today || !done) return null;

  const { program, position } = today;
  const day = position.kind === "during" ? dayOf(program, position.day) : null;
  return (
    <View style={styles.section}>
      <SectionTitle title={t("halaqah.title")} icon="school-outline" hue="halaqah" />
      <Card hue="halaqah">
        <View style={styles.head}>
          <IconChip
            icon={day ? "play" : "school"}
            size={48}
            color={violet.base}
            background={violet.soft}
          />
          <View style={styles.grow}>
            {day ? (
              <>
                <Text style={[typography.overline, tabular, { color: violet.base }]}>
                  {t("halaqah.dayN", { day: day.day })}
                </Text>
                <Text style={[typography.headline, { color: theme.text }]}>{day.title[lang]}</Text>
              </>
            ) : (
              <>
                <Text style={[typography.headline, { color: theme.text }]}>
                  {t("halaqah.programTitle")}
                </Text>
                <Text style={[typography.subhead, { color: theme.muted }]}>
                  {t("halaqah.openAnyTime")}
                </Text>
              </>
            )}
          </View>
        </View>
        {day ? (
          <View style={styles.progress}>
            <ProgressTrack
              value={done.size / program.totalDays}
              fill={violet.base}
              track={violet.soft}
            />
            <Text style={[typography.footnote, tabular, { color: theme.muted }]}>
              {t("halaqah.progress", { done: done.size, total: program.totalDays })}
            </Text>
          </View>
        ) : null}
        <View style={styles.action}>
          <Button
            label={day ? t("halaqah.openToday") : t("halaqah.startEarly")}
            onPress={() => router.push("/halaqah")}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md - 4 },
  grow: { flex: 1, gap: 2 },
  progress: { gap: spacing.xs + 2, marginTop: spacing.sm },
  action: { marginTop: spacing.sm },
});
