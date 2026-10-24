import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { radius, spacing, useTheme } from "@/theme";

/** Padded body for a `Section` card. */
export function Panel({ children }: { children: ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
}

export function Button({
  label,
  onPress,
  tone = "primary",
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "plain";
  disabled?: boolean;
}) {
  const theme = useTheme();
  const primary = tone === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: primary ? theme.accent : "transparent",
          borderColor: primary ? theme.accent : theme.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text style={[styles.buttonLabel, { color: primary ? theme.accentText : theme.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

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
    <View style={[styles.toggleRow, { borderColor: theme.border }]}>
      <View style={styles.toggleText}>
        <Text style={[styles.toggleLabel, { color: theme.text }]}>{label}</Text>
        {hint ? <Text style={[styles.hint, { color: theme.muted }]}>{hint}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        disabled={disabled}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: theme.accent, false: theme.border }}
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
      <Text style={[styles.hint, { color: theme.muted }]}>{label}</Text>
      <View
        style={[styles.inputWrap, { borderColor: theme.border, backgroundColor: theme.background }]}
      >
        <TextInput
          accessibilityLabel={label}
          keyboardType={decimal ? "decimal-pad" : "number-pad"}
          placeholder={placeholder}
          placeholderTextColor={theme.muted}
          value={text}
          onChangeText={(next) => {
            setText(next);
            const trimmed = next.trim().replace(",", ".");
            const parsed = trimmed === "" ? null : Number(trimmed);
            onChangeNumber(
              parsed !== null && Number.isFinite(parsed) && parsed >= 0 ? parsed : null,
            );
          }}
          style={[styles.input, { color: theme.text }]}
        />
        {suffix ? <Text style={{ color: theme.muted }}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

export function ProgressBar({ fraction }: { fraction: number }) {
  const theme = useTheme();
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <View style={[styles.track, { backgroundColor: theme.border }]}>
      <View
        style={[
          styles.fill,
          { backgroundColor: theme.accent, width: `${Math.round(clamped * 100)}%` },
        ]}
      />
    </View>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.hint, { color: theme.muted }]}>{children}</Text>;
}

export function Heading({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.heading, { color: theme.text }]}>{children}</Text>;
}

export function ButtonRow({ children }: { children: ReactNode }) {
  return <View style={styles.buttonRow}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: { padding: spacing.md, gap: spacing.md },
  button: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: { fontSize: 15, fontWeight: "600" },
  buttonRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  toggleRow: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel: { fontSize: 16 },
  hint: { fontSize: 13, lineHeight: 18 },
  heading: { fontSize: 20, fontWeight: "700" },
  field: { gap: spacing.xs },
  inputWrap: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: spacing.sm },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
});
