import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text } from "react-native";

import { PressableScale, type IconName } from "@/components/ui";
import { HIT, radius, spacing, typography, useTheme } from "@/theme";

/** Full-width pill button: a filled accent call to action, or an outlined secondary one. */
export function PillButton({
  label,
  onPress,
  icon,
  tone = "primary",
  disabled,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  tone?: "primary" | "secondary";
  disabled?: boolean;
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
        primary
          ? { backgroundColor: theme.accent, borderColor: theme.accent }
          : { backgroundColor: "transparent", borderColor: theme.border },
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={color} /> : null}
      <Text style={[primary ? typography.headline : typography.body, { color }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: HIT + 6,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
});
