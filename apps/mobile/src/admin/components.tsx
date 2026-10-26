import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { CirclesHttpError } from "@/circles/api";
import { radius, spacing, typography, useTheme } from "@/theme";

/** Small status label: hidden, suspended, crash. */
export function Badge({
  label,
  color,
  background,
}: {
  label: string;
  color: string;
  background: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[typography.caption, styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

/** One-line result of the last action, read out by screen readers. */
export function Notice({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.notice, { backgroundColor: theme.accentSoft }]}
    >
      <Ionicons
        name="information-circle"
        size={18}
        color={theme.accent}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={[typography.subhead, styles.grow, { color: theme.text }]}>{text}</Text>
    </View>
  );
}

/** `circles.errors.*` key for a failed admin call. */
export const adminErrorKey = (e: unknown): string =>
  `circles.errors.${e instanceof CirclesHttpError ? e.key : "generic"}`;

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeText: { fontWeight: "700" },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  grow: { flex: 1 },
});
