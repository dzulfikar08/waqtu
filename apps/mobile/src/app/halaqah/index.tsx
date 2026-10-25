import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HeroGlow } from "@/components/HeroGlow";
import { IconChip, PressableScale, ProgressTrack } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { Hint } from "@/ramadhan/components/fields";
import { HIT, onSky, radius, spacing, tabular, typography, useTheme } from "@/theme";
import { DayList } from "@/halaqah/components/DayList";
import { NudgeSettings } from "@/halaqah/components/NudgeSettings";
import { SessionView, useLang } from "@/halaqah/components/SessionView";
import { halaqahAvailable } from "@/halaqah/bundled";
import { dayOf } from "@/halaqah/program";
import { nextUncompletedDay } from "@/halaqah/schedule";
import { useHalaqahProgress, useHalaqahToday } from "@/halaqah/useHalaqah";

/** The halaqah hero's violet-to-plum gradient: [light, dark]. */
const HERO = {
  light: "linear-gradient(145deg, #7C4DCC 0%, #B23A8F 100%)",
  dark: "linear-gradient(145deg, #2E1F52 0%, #41183A 100%)",
} as const;

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
      <View
        style={[
          styles.hero,
          {
            experimental_backgroundImage: theme.dark ? HERO.dark : HERO.light,
            boxShadow: theme.dark
              ? "0 10px 24px -12px rgba(0,0,0,0.6)"
              : "0 14px 28px -14px rgba(124,77,204,0.55)",
          },
        ]}
      >
        <HeroGlow breathe glow="rgba(236,214,255,0.45)" />
        <View style={styles.head}>
          <View
            style={[styles.badge, { backgroundColor: onSky.glassStrong, borderColor: onSky.line }]}
          >
            <Ionicons
              name="school"
              size={24}
              color={onSky.text}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          </View>
          <View style={styles.grow}>
            <Text style={[typography.title, { color: onSky.text }]}>{program.title[lang]}</Text>
            {position.kind === "before" ? (
              <Text style={[typography.subhead, tabular, { color: onSky.muted }]}>
                {position.daysUntil === null
                  ? t("halaqah.forYear", { year: program.hijriYear })
                  : t("halaqah.beforeRamadhan", { count: position.daysUntil })}
              </Text>
            ) : null}
            {position.kind === "after" ? (
              <Text style={[typography.subhead, tabular, { color: onSky.muted }]}>
                {t("halaqah.afterRamadhan", { year: program.hijriYear })}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.figureRow}>
          <Text style={[styles.figure, tabular, { color: onSky.text }]}>
            {done.size}
            <Text style={[styles.total, { color: onSky.muted }]}>/{program.totalDays}</Text>
          </Text>
          <Text style={[typography.footnote, styles.grow, { color: onSky.muted, lineHeight: 18 }]}>
            {t("halaqah.progress", { done: done.size, total: program.totalDays })}
          </Text>
        </View>
        <ProgressTrack
          value={done.size / program.totalDays}
          fill="rgba(255,255,255,0.95)"
          track={onSky.glass}
          height={8}
        />
        {!todayDay && next !== null ? (
          <View style={styles.start}>
            <PressableScale
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/halaqah/[day]", params: { day: next } })}
              style={[styles.heroButton, { backgroundColor: onSky.text }]}
            >
              <Text style={[styles.heroButtonLabel, { color: theme.dark ? "#2E1F52" : "#7C4DCC" }]}>
                {done.size === 0
                  ? t("halaqah.startEarly")
                  : t("halaqah.continueFrom", { day: next })}
              </Text>
            </PressableScale>
            <Text style={[typography.footnote, { color: onSky.muted, lineHeight: 18 }]}>
              {t("halaqah.openAnyTime")}
            </Text>
          </View>
        ) : null}
      </View>

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
  hero: {
    borderRadius: radius.lg + 4,
    padding: spacing.md + 4,
    gap: spacing.sm,
    overflow: "hidden",
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  figureRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm },
  figure: { fontSize: 48, fontWeight: "800", letterSpacing: -1 },
  total: { fontSize: 22, fontWeight: "700", letterSpacing: 0 },
  start: { gap: spacing.sm, marginTop: spacing.sm },
  heroButton: {
    alignSelf: "flex-start",
    minHeight: HIT,
    paddingHorizontal: spacing.md + 4,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  heroButtonLabel: { ...typography.callout, fontWeight: "700" },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 4,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  allDays: { gap: spacing.xs, paddingHorizontal: spacing.xs, marginBottom: -spacing.sm },
});
