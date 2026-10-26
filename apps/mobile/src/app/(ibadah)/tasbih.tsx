import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, Vibration, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { itemLabel } from "@/components/itemLabel";
import {
  Card,
  PressableScale,
  ProgressTrack,
  Row,
  Section,
  StepperRow,
} from "@/components/ui";
import { setEntry } from "@/db/entries";
import { useMutabaah } from "@/hooks/useMutabaah";
import { useTranslation } from "@/i18n";
import { ArabicText } from "@/ibadah/components/ArabicText";
import { useLocalValue } from "@/ibadah/store";
import {
  PRESET_IDS,
  TASBIH_KEY,
  addedCount,
  choosePreset,
  linkableItems,
  linkedItemOf,
  loadPhrases,
  parseTasbih,
  positionOf,
  presetPhases,
  reset,
  serializeTasbih,
  setCustomTarget,
  tap,
  undo,
  type TasbihState,
} from "@/ibadah/tasbih";
import { Button, ToggleRow } from "@/ramadhan/components/fields";
import { hueColors, radius, spacing, tabular, typography, useTheme } from "@/theme";

/** Steps of the free count's target: tap − / + to move by these. */
const TARGET_STEPS = [0, 7, 10, 11, 33, 99, 100, 313, 500, 1000];

/**
 * A tasbih: one big tap target, the 33/33/34 after the prayer or 100 of one phrase or a free count, a buzz per tap and
 * a longer one at each part and round. The count is stored on the phone, so it survives closing the app; with a
 * custom counter item linked it can be added to today's mutabaah.
 */
export default function TasbihScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const router = useRouter();
  const model = useMutabaah();
  const [state, save] = useLocalValue(TASBIH_KEY, parseTasbih, serializeTasbih);
  const [recorded, setRecorded] = useState<string | null>(null);
  const colors = hueColors(theme, "tasbih");
  const phrases = loadPhrases();
  const phases = useMemo(
    () => (state ? presetPhases(state.preset, phrases, state.customTarget) : null),
    [state, phrases],
  );
  if (!state || !phases) return null;

  const at = positionOf(state.count, phases);
  const phase = phases[at.phase];
  const linkable = model ? linkableItems(model.items) : [];
  const linked = model ? linkedItemOf(state, model.items) : null;
  const update = (next: TasbihState) => {
    setRecorded(null);
    save(next);
  };

  const onTap = () => {
    const result = tap(state, phases);
    update(result.state);
    if (!state.vibrate) return;
    if (result.event === "round") Vibration.vibrate([0, 80, 80, 80]);
    else if (result.event === "phase") Vibration.vibrate(120);
    else Vibration.vibrate(15);
  };

  const confirmReset = () =>
    Alert.alert(t("ibadah.tasbih.resetTitle"), t("ibadah.tasbih.resetBody"), [
      { text: t("ibadah.tasbih.cancel"), style: "cancel" },
      {
        text: t("ibadah.tasbih.confirmReset"),
        style: "destructive",
        onPress: () => update(reset(state)),
      },
    ]);

  const record = async () => {
    if (!model || !linked || state.count === 0) return;
    const current = model.todayEntries.get(linked.id) ?? 0;
    const count = state.count;
    await setEntry(db, model.today, linked.id, addedCount(current, count));
    save(reset(state));
    setRecorded(t("ibadah.tasbih.recorded", { count, item: itemLabel(linked, t) }));
  };

  const targetIndex = Math.max(0, TARGET_STEPS.indexOf(state.customTarget));
  const showEnglish = i18n.language === "en";
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presets}
        accessibilityLabel={t("ibadah.tasbih.presets")}
      >
        {PRESET_IDS.map((id) => {
          const on = state.preset === id;
          return (
            <PressableScale
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityHint={t(`ibadah.tasbih.presetHint.${id}`)}
              onPress={() => update(choosePreset(state, id))}
              scaleTo={0.95}
              style={[
                styles.preset,
                {
                  backgroundColor: on ? colors.base : theme.surface,
                  borderColor: on ? colors.base : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  typography.subhead,
                  tabular,
                  { color: on ? theme.surface : theme.text, fontWeight: "700" },
                ]}
              >
                {t(`ibadah.tasbih.preset.${id}`)}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>

      <Card hue="tasbih">
        {phase.phrase ? (
          <View style={styles.phrase}>
            <ArabicText size={30} center>
              {phase.phrase.arabic}
            </ArabicText>
            <Text style={[typography.headline, { color: colors.base, textAlign: "center" }]}>
              {phase.phrase.transliteration}
            </Text>
            {showEnglish ? (
              <Text style={[typography.subhead, { color: theme.muted, textAlign: "center" }]}>
                {phase.phrase.translation}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={[typography.subhead, { color: theme.muted, textAlign: "center" }]}>
            {t("ibadah.tasbih.presetHint.custom")}
          </Text>
        )}
        {phases.length > 1 ? (
          <View style={styles.phases}>
            {phases.map((p, i) => (
              <View
                key={i}
                style={[
                  styles.phaseDot,
                  {
                    flex: p.target,
                    backgroundColor:
                      i < at.phase || (i === at.phase && at.inPhase === at.target)
                        ? colors.base
                        : i === at.phase
                          ? colors.soft
                          : theme.surfaceAlt,
                  },
                ]}
              />
            ))}
          </View>
        ) : null}
      </Card>

      <View style={styles.counterWrap}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t("ibadah.tasbih.counterLabel", { count: at.inPhase })}
          accessibilityHint={t("ibadah.tasbih.tap")}
          onPress={onTap}
          scaleTo={0.96}
          style={[
            styles.counter,
            {
              backgroundColor: colors.soft,
              borderColor: at.roundComplete ? theme.accent : colors.base,
              boxShadow: theme.dark ? undefined : `0 18px 36px -18px ${colors.base}`,
            },
          ]}
        >
          <Text style={[styles.count, tabular, { color: theme.text }]}>{at.inPhase}</Text>
          <Text style={[typography.subhead, tabular, { color: theme.muted }]}>
            {at.target > 0 ? t("ibadah.tasbih.of", { target: at.target }) : t("ibadah.tasbih.tap")}
          </Text>
          {at.roundComplete ? (
            <View style={styles.done}>
              <Ionicons name="checkmark-circle" size={18} color={theme.accent} />
              <Text style={[typography.footnote, { color: theme.accent, fontWeight: "700" }]}>
                {t("ibadah.tasbih.roundDone")}
              </Text>
            </View>
          ) : null}
        </PressableScale>
        {at.target > 0 ? (
          <View style={styles.track}>
            <ProgressTrack
              value={at.inPhase / at.target}
              fill={colors.base}
              track={theme.surfaceAlt}
            />
          </View>
        ) : null}
        <Text style={[typography.footnote, tabular, { color: theme.muted }]}>
          {t("ibadah.tasbih.total", { count: state.count })}
          {at.rounds > 0 ? ` · ${t("ibadah.tasbih.round", { count: at.rounds })}` : ""}
        </Text>
        <View style={styles.actions}>
          <Button
            label={t("ibadah.tasbih.undo")}
            icon="remove"
            tone="plain"
            disabled={state.count === 0}
            onPress={() => update(undo(state))}
          />
          <Button
            label={t("ibadah.tasbih.reset")}
            icon="refresh"
            tone="plain"
            disabled={state.count === 0}
            onPress={confirmReset}
          />
        </View>
        <Text style={[typography.caption, { color: theme.faint }]}>
          {t("ibadah.tasbih.keepsCount")}
        </Text>
      </View>

      <Section title={t("ibadah.tasbih.presets")} icon="options-outline" hue="tasbih">
        {state.preset === "custom" ? (
          <StepperRow
            label={t("ibadah.tasbih.target")}
            value={targetIndex}
            min={0}
            max={TARGET_STEPS.length - 1}
            format={(i) => (TARGET_STEPS[i] === 0 ? "∞" : String(TARGET_STEPS[i]))}
            onChange={(i) => update(setCustomTarget(state, TARGET_STEPS[i]))}
          />
        ) : null}
        <ToggleRow
          label={t("ibadah.tasbih.vibrate")}
          hint={t("ibadah.tasbih.vibrateHint")}
          value={state.vibrate}
          onValueChange={(vibrate) => update({ ...state, vibrate })}
        />
      </Section>

      <Section
        title={t("ibadah.tasbih.mutabaah")}
        icon="checkbox-outline"
        hue="brand"
        footer={linkable.length > 0 ? t("ibadah.tasbih.linkHint") : undefined}
      >
        {linkable.length === 0 ? (
          <>
            <Text style={[typography.subhead, styles.note, { color: theme.muted }]}>
              {t("ibadah.tasbih.noCounters")}
            </Text>
            <Row
              label={t("ibadah.tasbih.manage")}
              icon="list-outline"
              hue="brand"
              chevron
              onPress={() => router.push("/items")}
            />
          </>
        ) : (
          <>
            {linkable.map((item) => (
              <Row
                key={item.id}
                label={itemLabel(item, t)}
                detail={t("ibadah.tasbih.todayValue", {
                  n: model?.todayEntries.get(item.id) ?? 0,
                })}
                icon="add-circle-outline"
                hue="brand"
                selected={linked?.id === item.id}
                onPress={() =>
                  update({ ...state, linkedItem: linked?.id === item.id ? null : item.id })
                }
              />
            ))}
            {linked ? (
              <View style={styles.record}>
                <Button
                  label={t("ibadah.tasbih.record", {
                    count: state.count,
                    item: itemLabel(linked, t),
                  })}
                  icon="checkmark-circle-outline"
                  block
                  disabled={state.count === 0}
                  onPress={() => void record()}
                />
              </View>
            ) : null}
            {recorded ? (
              <Text style={[typography.footnote, styles.note, { color: theme.accent }]}>
                {recorded}
              </Text>
            ) : null}
          </>
        )}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md + 4, paddingTop: spacing.md, gap: spacing.lg },
  presets: { gap: spacing.sm, paddingVertical: 2 },
  preset: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  phrase: { gap: spacing.xs, alignItems: "stretch" },
  phases: { flexDirection: "row", gap: 4, marginTop: spacing.xs },
  phaseDot: { height: 6, borderRadius: 3 },
  counterWrap: { alignItems: "center", gap: spacing.sm + 2 },
  counter: {
    width: 232,
    height: 232,
    borderRadius: 116,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  count: { fontSize: 72, fontWeight: "800", letterSpacing: -2, lineHeight: 80 },
  done: { flexDirection: "row", alignItems: "center", gap: 4 },
  track: { alignSelf: "stretch", paddingHorizontal: spacing.xl },
  actions: { flexDirection: "row", gap: spacing.sm },
  note: { padding: spacing.md, lineHeight: 20 },
  record: { padding: spacing.md },
});
