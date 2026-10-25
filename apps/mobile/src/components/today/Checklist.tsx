import { useSQLiteContext } from "expo-sqlite";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";

import { itemLabel } from "@/components/itemLabel";
import { setEntry } from "@/db/entries";
import { useTranslation } from "@/i18n";
import { FLAG, clampCount, toggleFardh, type FardhAction, type ItemDef } from "@/mutabaah/items";
import type { DayPeriod } from "@/prayer/period";
import { hueColors, prayerTone, spacing, tabular, typography, useTheme } from "@/theme";

import { CheckCircle, Divider, Pill, PressableScale, ProgressTrack, StepButton } from "../ui";

import { PrayerGlyph } from "./PrayerCards";

interface Props {
  items: readonly ItemDef[];
  day: string;
  entries: ReadonlyMap<string, number>;
  /** "HH:mm" per prayer id, shown on the fardh rows. */
  prayerTimes: Readonly<Record<string, string | null>> | null;
}

const BOX = 26;
const GAP = 14;
/** Where a row's text starts: the chips and separators line up with it. */
const TEXT_INSET = spacing.md + BOX + GAP;

export function Checklist({ items, day, entries, prayerTimes }: Props) {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const theme = useTheme();

  const write = useCallback(
    (itemId: string, value: number) => void setEntry(db, day, itemId, value),
    [db, day],
  );

  if (items.length === 0) {
    return (
      <Text style={[typography.subhead, { color: theme.muted, padding: spacing.md }]}>
        {t("mutabaah.empty")}
      </Text>
    );
  }

  const done = items.filter((item) => {
    const value = entries.get(item.id) ?? 0;
    return item.kind === "fardh" ? (value & FLAG.DONE) !== 0 : value > 0;
  }).length;

  return (
    <View>
      <Progress done={done} total={items.length} />
      {items.map((item, index) => {
        const value = entries.get(item.id) ?? 0;
        const name = itemLabel(item, t);
        const row =
          item.kind === "fardh" ? (
            <FardhRow
              prayer={item.id as DayPeriod}
              name={name}
              time={prayerTimes?.[item.id] ?? null}
              value={value}
              onAction={(action) => write(item.id, toggleFardh(value, action))}
            />
          ) : item.kind === "count" ? (
            <CountRow
              name={name}
              value={value}
              onChange={(next) => write(item.id, clampCount(next))}
            />
          ) : (
            <CheckRow
              name={name}
              done={value > 0}
              onToggle={() => write(item.id, value > 0 ? 0 : 1)}
            />
          );
        return (
          <View key={item.id}>
            <Divider inset={index > 0 ? TEXT_INSET : 0} />
            {row}
          </View>
        );
      })}
    </View>
  );
}

/** Today's count in large digits over a bar that grows as items are ticked. */
function Progress({ done, total }: { done: number; total: number }) {
  const theme = useTheme();
  const brand = hueColors(theme, "brand");
  const fraction = total > 0 ? done / total : 0;
  const complete = total > 0 && done === total;
  return (
    <View style={styles.progress} accessible accessibilityLabel={`${done}/${total}`}>
      <View style={styles.progressHead}>
        <Text style={[styles.progressFigure, tabular, { color: theme.text }]}>
          {done}
          <Text style={[styles.progressTotal, { color: theme.faint }]}>/{total}</Text>
        </Text>
        <Text
          style={[typography.headline, tabular, { color: complete ? brand.base : theme.muted }]}
        >
          {Math.round(fraction * 100)}%
        </Text>
      </View>
      <ProgressTrack
        value={fraction}
        fill={`linear-gradient(90deg, ${theme.accent} 0%, ${hueColors(theme, "hafalan").base} 100%)`}
        track={theme.surfaceAlt}
        height={10}
      />
    </View>
  );
}

function CheckRow({ name, done, onToggle }: { name: string; done: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={done ? t("mutabaah.unmark", { name }) : t("mutabaah.markDone", { name })}
      onPress={onToggle}
      scaleTo={0.985}
      style={styles.row}
    >
      <CheckCircle checked={done} size={BOX} />
      <Text style={[typography.body, styles.grow, { color: done ? theme.muted : theme.text }]}>
        {name}
      </Text>
    </PressableScale>
  );
}

function CountRow({
  name,
  value,
  onChange,
}: {
  name: string;
  value: number;
  onChange: (next: number) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <CheckCircle checked={value > 0} size={BOX} />
      <View style={styles.grow}>
        <Text style={[typography.body, { color: theme.text }]}>{name}</Text>
        <Text
          style={[typography.footnote, tabular, { color: value > 0 ? theme.accent : theme.muted }]}
        >
          {t("mutabaah.pages", { n: value })}
        </Text>
      </View>
      <View style={styles.stepper}>
        <StepButton
          label={t("mutabaah.decrease", { name })}
          symbol="−"
          disabled={value <= 0}
          onPress={() => onChange(value - 1)}
        />
        <StepButton
          label={t("mutabaah.increase", { name })}
          symbol="+"
          onPress={() => onChange(value + 1)}
        />
      </View>
    </View>
  );
}

function FardhRow({
  prayer,
  name,
  time,
  value,
  onAction,
}: {
  prayer: DayPeriod;
  name: string;
  time: string | null;
  value: number;
  onAction: (action: FardhAction) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const done = (value & FLAG.DONE) !== 0;
  return (
    <View style={styles.fardh}>
      <PressableScale
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={
          done ? t("mutabaah.unmark", { name }) : t("mutabaah.markDone", { name })
        }
        onPress={() => onAction("done")}
        scaleTo={0.985}
        style={styles.fardhTop}
      >
        <CheckCircle checked={done} size={BOX} />
        <Text style={[typography.body, styles.grow, { color: theme.text, fontWeight: "600" }]}>
          {name}
        </Text>
        {time ? (
          <View style={styles.time}>
            <PrayerGlyph prayer={prayer} size={16} color={prayerTone(prayer, theme.dark)} />
            <Text style={[typography.callout, tabular, { color: theme.muted }]}>{time}</Text>
          </View>
        ) : null}
      </PressableScale>
      <View style={styles.chips}>
        <Pill
          label={t("mutabaah.onTime")}
          on={(value & FLAG.ONTIME) !== 0}
          onPress={() => onAction("ontime")}
        />
        <Pill
          label={t("mutabaah.jamaah")}
          on={(value & FLAG.JAMAAH) !== 0}
          onPress={() => onAction("jamaah")}
        />
        <Pill
          label={t("mutabaah.qadha")}
          on={(value & FLAG.QADHA) !== 0}
          onPress={() => onAction("qadha")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: GAP,
  },
  fardh: { paddingTop: spacing.xs, paddingBottom: spacing.md - 2 },
  fardhTop: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: GAP,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingLeft: TEXT_INSET,
    paddingRight: spacing.md,
  },
  grow: { flex: 1 },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  time: { flexDirection: "row", alignItems: "center", gap: 5 },
  progress: { padding: spacing.md, gap: spacing.sm + 2 },
  progressHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  progressFigure: { fontSize: 34, fontWeight: "800", letterSpacing: -0.8 },
  progressTotal: { fontSize: 20, fontWeight: "700" },
});
