import { Ionicons } from "@expo/vector-icons";
import { canGrade, newUnitState } from "@waqtu/core";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTranslation } from "@/i18n";
import { Recitation, type SeekToAyah } from "@/hafalan/components/Recitation";
import { UnitText, type TestMode } from "@/hafalan/components/UnitText";
import { gradeUnitToday } from "@/hafalan/db";
import { nextTodo, unitLabel, unitRole } from "@/hafalan/format";
import { unitBlocks, wordKeys } from "@/hafalan/text";
import { QuranCredit } from "@/hafalan/components/QuranCredit";
import { useHafalan } from "@/hafalan/useHafalan";
import { useQuranFont } from "@/hafalan/useQuranFont";
import { Button, ButtonRow, Hint } from "@/ramadhan/components/fields";
import type { CheckView } from "@/recitation/check";
import { RecitationCheck } from "@/recitation/components/RecitationCheck";
import { useRecitationDev } from "@/recitation/useDevSettings";
import { IconChip, PressableScale, Section, type IconName } from "@/components/ui";
import { HIT, radius, spacing, tabular, typography, useTheme } from "@/theme";

const FONT_SIZE = 30;
const MODES: readonly TestMode[] = ["show", "hide", "letters"];
const MODE_LABEL = {
  show: "hafalan.modeShow",
  hide: "hafalan.modeHide",
  letters: "hafalan.modeLetters",
} as const;

/** One unit: the text with a hide-and-reveal self-test, the self-grade, and a recitation recording. */
export default function UnitScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const font = useQuranFont();
  const { unit: param } = useLocalSearchParams<{ unit: string }>();
  const index = Number(param);
  const model = useHafalan();
  const data = model?.data ?? null;
  const unit = data && Number.isInteger(index) ? data.units[index] : undefined;

  const [mode, setMode] = useState<TestMode>("show");
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const [graded, setGraded] = useState<{ due: string; dayComplete: boolean } | null>(null);
  const [activeAyah, setActiveAyah] = useState<number | null>(null);
  const seekRef = useRef<SeekToAyah | null>(null);
  const dev = useRecitationDev();
  const [check, setCheck] = useState<CheckView | null>(null);

  useEffect(() => {
    setMode("show");
    setRevealed(new Set());
    setGraded(null);
    setCheck(null);
  }, [index]);

  const blocks = useMemo(() => (unit ? unitBlocks(unit) : []), [unit]);
  const keys = useMemo(() => wordKeys(blocks), [blocks]);

  if (!model) return null;
  if (!data || !unit) {
    return <Text style={[styles.message, { color: theme.muted }]}>{t("hafalan.notFound")}</Text>;
  }

  const state = data.states.find((s) => s.unit === index) ?? newUnitState(index);
  const role = unitRole(data.portion, index);
  const gradable = canGrade(state, data.today) && graded === null;
  const next = nextTodo(data.portion, index);
  const nextHidden = keys.find((k) => !revealed.has(k));
  const recording = data.recordings.get(index);
  const ayahCount = unit.end - unit.start + 1;

  const changeMode = (m: TestMode) => {
    setMode(m);
    setRevealed(new Set());
  };
  const reveal = (key: string) => setRevealed((prev) => new Set(prev).add(key));

  const grade = async (value: number) => {
    const result = await gradeUnitToday(db, index, value, data.today);
    if (result) {
      setGraded({ due: result.state.due ?? "", dayComplete: result.dayComplete });
      setMode("show");
    }
  };

  const roleIcon: IconName =
    role === "sabaq"
      ? "book"
      : role === "murojaah"
        ? "repeat"
        : role === "done"
          ? "checkmark-done"
          : "time-outline";

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
    >
      <View style={styles.header}>
        <IconChip icon={roleIcon} size={44} />
        <View style={styles.grow}>
          <Text style={[typography.title, { color: theme.text }]}>{unitLabel(unit)}</Text>
          <Text style={[typography.subhead, tabular, { color: theme.muted }]}>
            {t("hafalan.page", { page: unit.page })} ·{" "}
            {t(
              role === "sabaq"
                ? "hafalan.unitSabaq"
                : role === "murojaah"
                  ? "hafalan.unitMurojaah"
                  : role === "done"
                    ? "hafalan.unitDone"
                    : "hafalan.unitOther",
            )}
          </Text>
        </View>
      </View>

      <UnitText
        blocks={blocks}
        mode={mode}
        revealed={revealed}
        onReveal={reveal}
        fontFamily={font.family}
        fontSize={FONT_SIZE}
        check={check}
        activeAyah={activeAyah}
        onAyahPress={recording?.marks.length ? (ayah) => seekRef.current?.(ayah) : undefined}
      />

      <Section title={t("hafalan.test")} icon="eye-off-outline">
        <View style={styles.panel}>
          <View style={[styles.segments, { backgroundColor: theme.surfaceAlt }]}>
            {MODES.map((m) => (
              <PressableScale
                key={m}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === m }}
                onPress={() => changeMode(m)}
                scaleTo={0.96}
                style={[
                  styles.segment,
                  { backgroundColor: mode === m ? theme.accent : "transparent" },
                ]}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[
                    typography.subhead,
                    styles.segmentLabel,
                    { color: mode === m ? theme.accentText : theme.muted },
                  ]}
                >
                  {t(MODE_LABEL[m])}
                </Text>
              </PressableScale>
            ))}
          </View>
          {mode !== "show" ? (
            <>
              <Hint>{t("hafalan.testHint")}</Hint>
              <ButtonRow>
                <Button
                  tone="plain"
                  label={t("hafalan.revealNext")}
                  disabled={nextHidden === undefined}
                  onPress={() => nextHidden !== undefined && reveal(nextHidden)}
                />
                <Button
                  tone="plain"
                  label={t("hafalan.revealAll")}
                  disabled={nextHidden === undefined}
                  onPress={() => setRevealed(new Set(keys))}
                />
                <Button
                  tone="plain"
                  label={t("hafalan.hideAll")}
                  disabled={revealed.size === 0}
                  onPress={() => setRevealed(new Set())}
                />
              </ButtonRow>
            </>
          ) : null}
        </View>
      </Section>

      <Section title={t("hafalan.grade")} icon="ribbon-outline">
        <View style={styles.panel}>
          {graded ? (
            <>
              <View style={[styles.saved, { backgroundColor: theme.accentSoft }]}>
                <Ionicons name="checkmark-circle" size={22} color={theme.accent} />
                <Text
                  style={[
                    typography.callout,
                    styles.grow,
                    { color: theme.accent, fontWeight: "600" },
                  ]}
                >
                  {graded.dayComplete
                    ? t("hafalan.gradedDone")
                    : t("hafalan.graded", { day: graded.due })}
                </Text>
              </View>
              <ButtonRow>
                {next !== null ? (
                  <Button
                    label={t("hafalan.next")}
                    onPress={() =>
                      router.replace({
                        pathname: "/hafalan/[unit]",
                        params: { unit: String(next) },
                      })
                    }
                  />
                ) : null}
                <Button tone="plain" label={t("hafalan.back")} onPress={() => router.back()} />
              </ButtonRow>
            </>
          ) : (
            <>
              <Hint>{gradable ? t("hafalan.gradeHint") : t("hafalan.unitDone")}</Hint>
              <View style={styles.grades}>
                {([0, 1, 2, 3, 4, 5] as const).map((g) => {
                  const good = g >= 3;
                  return (
                    <PressableScale
                      key={g}
                      accessibilityRole="button"
                      accessibilityLabel={`${g} · ${t(`hafalan.grades.${g}`)}`}
                      accessibilityState={{ disabled: !gradable }}
                      disabled={!gradable}
                      onPress={() => void grade(g)}
                      style={[
                        styles.gradeCell,
                        {
                          backgroundColor: good ? theme.accentSoft : theme.surfaceAlt,
                          borderColor: good ? theme.accent : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.gradeFigure,
                          tabular,
                          { color: good ? theme.accent : theme.text },
                        ]}
                      >
                        {g}
                      </Text>
                      <Text
                        numberOfLines={2}
                        style={[typography.caption, styles.gradeLabel, { color: theme.muted }]}
                      >
                        {t(`hafalan.grades.${g}`)}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </Section>

      <Section title={t("hafalan.recitation")} icon="mic-outline">
        <View style={styles.panel}>
          <Recitation
            key={index}
            unit={index}
            saved={recording}
            ayahCount={ayahCount}
            onActiveAyah={setActiveAyah}
            seekRef={seekRef}
          />
        </View>
      </Section>
      {dev.enabled ? (
        <Section title={t("recitation.title")} icon="pulse-outline">
          <View style={styles.panel}>
            <RecitationCheck key={index} unit={unit} unitIndex={index} onView={setCheck} />
          </View>
        </Section>
      ) : null}
      <QuranCredit />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  message: { padding: spacing.lg },
  content: { paddingHorizontal: spacing.md + 4, paddingTop: spacing.sm, gap: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md - 4 },
  grow: { flex: 1, gap: 2 },
  panel: { padding: spacing.md, gap: spacing.md },
  segments: { flexDirection: "row", borderRadius: radius.pill, padding: 3, gap: 3 },
  segment: {
    flex: 1,
    minHeight: HIT - 6,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  segmentLabel: { fontWeight: "600" },
  saved: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md - 4,
    borderRadius: radius.md,
  },
  grades: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  gradeCell: {
    flexGrow: 1,
    flexBasis: "30%",
    minHeight: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  gradeFigure: { fontSize: 24, fontWeight: "800" },
  gradeLabel: { textAlign: "center" },
});
