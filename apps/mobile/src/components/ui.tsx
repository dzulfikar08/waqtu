import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { radius, spacing, useTheme } from "@/theme";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.muted }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {children}
      </View>
    </View>
  );
}

export function Row({
  label,
  selected,
  onPress,
  disabled,
  destructive,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.row, { borderColor: theme.border }]}
    >
      <Text style={[styles.rowLabel, { color: destructive ? theme.danger : theme.text }]}>
        {label}
      </Text>
      {selected ? <Text style={{ color: theme.accent, fontSize: 18 }}>✓</Text> : null}
    </Pressable>
  );
}

/** A label with − / + buttons around the current value. */
export function StepperRow({
  label,
  value,
  onChange,
  min,
  max,
  format = String,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  /** Shown in place of the raw number, e.g. a zero-padded minute. */
  format?: (value: number) => string;
}) {
  const theme = useTheme();
  const button = (symbol: string, next: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${symbol}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onChange(next)}
      style={[styles.step, { borderColor: theme.border, opacity: disabled ? 0.4 : 1 }]}
    >
      <Text style={{ color: theme.text, fontSize: 20 }}>{symbol}</Text>
    </Pressable>
  );
  return (
    <View style={[styles.row, { borderColor: theme.border }]}>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <View style={styles.stepper}>
        {button("−", value - 1, value <= min)}
        <Text style={[styles.stepValue, { color: theme.text }]}>{format(value)}</Text>
        {button("+", value + 1, value >= max)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    paddingHorizontal: spacing.sm,
  },
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 16, flexShrink: 1 },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  step: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: { minWidth: 28, textAlign: "center", fontSize: 16 },
});
