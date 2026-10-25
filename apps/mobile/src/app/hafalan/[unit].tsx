import { canGrade, newUnitState } from "@waqtu/core";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useTranslation } from "@/i18n";
import { Recitation } from "@/hafalan/components/Recitation";
import { UnitText, type TestMode } from "@/hafalan/components/UnitText";
import { gradeUnitToday } from "@/hafalan/db";
import { nextTodo, unitLabel, unitRole } from "@/hafalan/format";
import { unitBlocks, wordKeys } from "@/hafalan/text";
import { QuranCredit } from "@/hafalan/components/QuranCredit";
import { useHafalan } from "@/hafalan/useHafalan";
import { useQuranFont } from "@/hafalan/useQuranFont";
import { Button, ButtonRow, Heading, Hint } from "@/ramadhan/components/fields";
import { Section } from "@/components/ui";
import { spacing, useTheme } from "@/theme";

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
  const font = useQuranFont();
  const { unit: param } = useLocalSearchParams<{ unit: string }>();
  const index = Number(param);
  const model = useHafalan();
  const data = model?.data ?? null;
  const unit = data && Number.isInteger(index) ? data.units[index] : undefined;

  const [mode, setMode] = useState<TestMode>("show");
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const [graded, setGraded] = useState<{ due: string; dayComplete: boolean } | null>(null);

  useEffect(() => {
    setMode("show");
    setRevealed(new Set());
    setGraded(null);
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

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Heading>{unitLabel(unit)}</Heading>
        <Hint>
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
        </Hint>
      </View>

      <UnitText
        blocks={blocks}
        mode={mode}
        revealed={revealed}
        onReveal={reveal}
        fontFamily={font.family}
        fontSize={FONT_SIZE}
      />

      <Section title={t("hafalan.test")}>
        <View style={styles.panel}>
          <ButtonRow>
            {MODES.map((m) => (
              <Button
                key={m}
                label={t(MODE_LABEL[m])}
                tone={mode === m ? "primary" : "plain"}
                onPress={() => changeMode(m)}
              />
            ))}
          </ButtonRow>
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

      <Section title={t("hafalan.grade")}>
        <View style={styles.panel}>
          {graded ? (
            <>
              <Text style={{ color: theme.accent, fontWeight: "600" }}>
                {graded.dayComplete
                  ? t("hafalan.gradedDone")
                  : t("hafalan.graded", { day: graded.due })}
              </Text>
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
              <ButtonRow>
                {([0, 1, 2, 3, 4, 5] as const).map((g) => (
                  <Button
                    key={g}
                    tone={g >= 3 ? "primary" : "plain"}
                    disabled={!gradable}
                    label={`${g} · ${t(`hafalan.grades.${g}`)}`}
                    onPress={() => void grade(g)}
                  />
                ))}
              </ButtonRow>
            </>
          )}
        </View>
      </Section>

      <Section title={t("hafalan.recitation")}>
        <View style={styles.panel}>
          <Recitation key={index} unit={index} saved={data.recordings.get(index)} />
        </View>
      </Section>
      <QuranCredit />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  message: { padding: spacing.lg },
  content: { padding: spacing.md, gap: spacing.lg },
  header: { gap: spacing.xs, paddingHorizontal: spacing.sm },
  panel: { padding: spacing.md, gap: spacing.md },
});
