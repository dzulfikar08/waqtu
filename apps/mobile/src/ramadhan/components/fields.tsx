import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState, type ReactNode } from "react";
import { Platform, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { PressableScale, type IconName } from "@/components/ui";
import { HIT, radius, spacing, tabular, typography, useTheme } from "@/theme";

/** Padded body for a `Section` card. */
export function Panel({ children }: { children: ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
}

/** Pill button: a filled accent pill (primary) or an outlined one (plain); `block` makes it a full-width call to action. */
export function Button({
  label,
  onPress,
  tone = "primary",
  disabled,
  icon,
  block,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "plain";
  disabled?: boolean;
  icon?: IconName;
  block?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const primary = tone === "primary";
  const color = primary ? theme.accentText : theme.text;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        block ? styles.block : null,
        {
          backgroundColor: primary ? theme.accent : "transparent",
          borderColor: primary ? theme.accent : theme.border,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={color} /> : null}
      <Text style={[styles.buttonLabel, { color }]}>{label}</Text>
    </PressableScale>
  );
}

/** A labelled switch row with an optional hint, separated from the next row by a hairline. */
export function ToggleRow({
  label,
  hint,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.toggleRow, { borderColor: theme.separator }]}>
      <View style={styles.toggleText}>
        <Text style={[typography.body, { color: disabled ? theme.faint : theme.text }]}>
          {label}
        </Text>
        {hint ? <Text style={[styles.hint, { color: theme.muted }]}>{hint}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        disabled={disabled}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: theme.accent, false: theme.border }}
        ios_backgroundColor={theme.border}
        // iOS keeps its white thumb; Android's Material thumb otherwise ignores the theme.
        thumbColor={
          Platform.OS === "android" ? (theme.dark ? theme.text : theme.surface) : undefined
        }
      />
    </View>
  );
}

/**
 * Whole-number or decimal text field. Keeps its own text while typing and reports a parsed number
 * (null when empty or invalid) through `onChangeNumber`.
 */
export function NumberField({
  label,
  value,
  onChangeNumber,
  decimal,
  suffix,
  placeholder,
}: {
  label: string;
  value: number | null;
  onChangeNumber: (value: number | null) => void;
  decimal?: boolean;
  suffix?: string;
  placeholder?: string;
}) {
  const theme = useTheme();
  const [text, setText] = useState(value === null ? "" : String(value));

  // Follow outside changes (loaded setting, reset) without fighting what the user is typing.
  useEffect(() => {
    setText((current) => {
      const parsed = current.trim() === "" ? null : Number(current.replace(",", "."));
      return parsed === value ? current : value === null ? "" : String(value);
    });
  }, [value]);

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.muted }]}>{label}</Text>
      <View
        style={[styles.inputWrap, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}
      >
        <TextInput
          accessibilityLabel={label}
          keyboardType={decimal ? "decimal-pad" : "number-pad"}
          placeholder={placeholder}
          placeholderTextColor={theme.faint}
          selectionColor={theme.accent}
          value={text}
          onChangeText={(next) => {
            setText(next);
            const trimmed = next.trim().replace(",", ".");
            const parsed = trimmed === "" ? null : Number(trimmed);
            onChangeNumber(
              parsed !== null && Number.isFinite(parsed) && parsed >= 0 ? parsed : null,
            );
          }}
          style={[styles.input, tabular, { color: theme.text }]}
        />
        {suffix ? (
          <Text style={[typography.callout, { color: theme.muted, fontWeight: "600" }]}>
            {suffix}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Thin rounded bar: an accent fill over a soft track. */
export function ProgressBar({ fraction }: { fraction: number }) {
  const theme = useTheme();
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <View style={[styles.track, { backgroundColor: theme.surfaceAlt }]}>
      <View
        style={[
          styles.fill,
          { backgroundColor: theme.accent, width: `${Math.round(clamped * 100)}%` },
        ]}
      />
    </View>
  );
}

/** Secondary small print. */
export function Hint({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.hint, { color: theme.muted }]}>{children}</Text>;
}

/** Card-level figure or heading, in the title size. */
export function Heading({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[typography.title, tabular, { color: theme.text }]}>{children}</Text>;
}

/** Buttons side by side, wrapping onto a new line when they do not fit. */
export function ButtonRow({ children }: { children: ReactNode }) {
  return <View style={styles.buttonRow}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: { padding: spacing.md, gap: spacing.md },
  button: {
    minHeight: HIT,
    paddingHorizontal: spacing.md + 4,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  block: { alignSelf: "stretch", minHeight: HIT + 6, paddingHorizontal: spacing.lg },
  buttonLabel: { ...typography.callout, fontWeight: "600" },
  buttonRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  toggleRow: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toggleText: { flex: 1, gap: 2 },
  hint: { ...typography.footnote, lineHeight: 18 },
  field: { gap: 6 },
  fieldLabel: { ...typography.footnote, fontWeight: "600" },
  inputWrap: {
    minHeight: HIT + 4,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  input: { flex: 1, ...typography.body, fontWeight: "600", paddingVertical: spacing.sm },
  track: { height: 8, borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: 8, borderRadius: radius.pill },
});
