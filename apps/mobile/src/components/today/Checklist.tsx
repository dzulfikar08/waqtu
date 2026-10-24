import { useSQLiteContext } from "expo-sqlite";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { itemLabel } from "@/components/itemLabel";
import { setEntry } from "@/db/entries";
import { useTranslation } from "@/i18n";
import { FLAG, clampCount, toggleFardh, type FardhAction, type ItemDef } from "@/mutabaah/items";
import { radius, spacing, useTheme } from "@/theme";

interface Props {
  items: readonly ItemDef[];
  day: string;
  entries: ReadonlyMap<string, number>;
  /** "HH:mm" per prayer id, shown on the fardh rows. */
  prayerTimes: Readonly<Record<string, string | null>> | null;
}

export function Checklist({ items, day, entries, prayerTimes }: Props) {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const theme = useTheme();

  const write = useCallback(
    (itemId: string, value: number) => void setEntry(db, day, itemId, value),
    [db, day],
  );

  if (items.length === 0) {
    return <Text style={{ color: theme.muted, padding: spacing.md }}>{t("mutabaah.empty")}</Text>;
  }

  return (
    <View>
      {items.map((item) => {
        const value = entries.get(item.id) ?? 0;
        const name = itemLabel(item, t);
        if (item.kind === "fardh") {
          return (
            <FardhRow
              key={item.id}
              name={name}
              time={prayerTimes?.[item.id] ?? null}
              value={value}
              onAction={(action) => write(item.id, toggleFardh(value, action))}
            />
          );
        }
        if (item.kind === "count") {
          return (
            <CountRow
              key={item.id}
              name={name}
              value={value}
              onChange={(next) => write(item.id, clampCount(next))}
            />
          );
        }
        return (
          <CheckRow
            key={item.id}
            name={name}
            done={value > 0}
            onToggle={() => write(item.id, value > 0 ? 0 : 1)}
          />
        );
      })}
    </View>
  );
}

function Box({ checked }: { checked: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.box,
        {
          borderColor: checked ? theme.accent : theme.border,
          backgroundColor: checked ? theme.accent : "transparent",
        },
      ]}
    >
      {checked ? (
        <Text style={{ color: theme.accentText, fontSize: 16, fontWeight: "700" }}>✓</Text>
      ) : null}
    </View>
  );
}

function CheckRow({ name, done, onToggle }: { name: string; done: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={done ? t("mutabaah.unmark", { name }) : t("mutabaah.markDone", { name })}
      onPress={onToggle}
      style={[styles.row, { borderColor: theme.border }]}
    >
      <Box checked={done} />
      <Text style={[styles.label, { color: theme.text }]}>{name}</Text>
    </Pressable>
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
    <View style={[styles.row, { borderColor: theme.border }]}>
      <Box checked={value > 0} />
      <View style={styles.grow}>
        <Text style={[styles.label, { color: theme.text }]}>{name}</Text>
        <Text style={{ color: theme.muted, fontSize: 13 }}>
          {t("mutabaah.pages", { n: value })}
        </Text>
      </View>
      <Stepper
        label={t("mutabaah.decrease", { name })}
        symbol="−"
        disabled={value <= 0}
        onPress={() => onChange(value - 1)}
      />
      <Stepper
        label={t("mutabaah.increase", { name })}
        symbol="+"
        onPress={() => onChange(value + 1)}
      />
    </View>
  );
}

function Stepper({
  label,
  symbol,
  onPress,
  disabled,
}: {
  label: string;
  symbol: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.stepper, { borderColor: theme.border, opacity: disabled ? 0.4 : 1 }]}
    >
      <Text style={{ color: theme.text, fontSize: 20 }}>{symbol}</Text>
    </Pressable>
  );
}

function FardhRow({
  name,
  time,
  value,
  onAction,
}: {
  name: string;
  time: string | null;
  value: number;
  onAction: (action: FardhAction) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const done = (value & FLAG.DONE) !== 0;
  return (
    <View style={[styles.fardh, { borderColor: theme.border }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={
          done ? t("mutabaah.unmark", { name }) : t("mutabaah.markDone", { name })
        }
        onPress={() => onAction("done")}
        style={styles.fardhTop}
      >
        <Box checked={done} />
        <Text style={[styles.label, styles.grow, { color: theme.text }]}>{name}</Text>
        {time ? <Text style={{ color: theme.muted, fontSize: 15 }}>{time}</Text> : null}
      </Pressable>
      <View style={styles.chips}>
        <Chip
          label={t("mutabaah.onTime")}
          on={(value & FLAG.ONTIME) !== 0}
          onPress={() => onAction("ontime")}
        />
        <Chip
          label={t("mutabaah.jamaah")}
          on={(value & FLAG.JAMAAH) !== 0}
          onPress={() => onAction("jamaah")}
        />
        <Chip
          label={t("mutabaah.qadha")}
          on={(value & FLAG.QADHA) !== 0}
          onPress={() => onAction("qadha")}
        />
      </View>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      hitSlop={6}
      style={[
        styles.chip,
        {
          borderColor: on ? theme.accent : theme.border,
          backgroundColor: on ? theme.accent : "transparent",
        },
      ]}
    >
      <Text style={{ color: on ? theme.accentText : theme.text, fontSize: 13, fontWeight: "600" }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fardh: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fardhTop: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingLeft: 36 + spacing.md },
  chip: {
    minHeight: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  box: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 16, flexShrink: 1 },
  grow: { flex: 1 },
  stepper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
