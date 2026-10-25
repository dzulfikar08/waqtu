import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { IconName } from "@/components/ui";
import { hueColors, radius, spacing, tabular, typography, useTheme, type Hue } from "@/theme";

/**
 * A figure tile: an uppercase label over a large number, on a faint wash of `hue`. `highlight` draws it on the hue's
 * stronger wash in the hue's colour.
 */
export function Stat({
  label,
  value,
  accessibilityLabel,
  highlight,
  hue = "brand",
}: {
  label: string;
  value: string | number;
  accessibilityLabel?: string;
  highlight?: boolean;
  hue?: Hue;
}) {
  const theme = useTheme();
  const tint = hueColors(theme, hue);
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? `${label}: ${value}`}
      style={[
        styles.stat,
        highlight
          ? { backgroundColor: tint.soft, borderColor: tint.soft }
          : { backgroundColor: tint.wash, borderColor: tint.soft },
      ]}
    >
      <Text
        style={[typography.overline, { color: highlight ? tint.base : theme.muted }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
      <Text
        style={[styles.statValue, tabular, { color: highlight ? tint.base : theme.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

/** Tiles side by side, sharing the width. */
export function StatRow({ children }: { children: ReactNode }) {
  return <View style={styles.statRow}>{children}</View>;
}

/** A calculated result on a wash of `hue`: a glyph beside the figures. */
export function ResultBox({
  icon,
  hue = "brand",
  children,
}: {
  icon: IconName;
  hue?: Hue;
  children: ReactNode;
}) {
  const theme = useTheme();
  const tint = hueColors(theme, hue);
  return (
    <View
      style={[
        styles.result,
        {
          borderColor: tint.soft,
          experimental_backgroundImage: `linear-gradient(135deg, ${tint.soft} 0%, ${tint.wash} 100%)`,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={tint.base}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <View style={styles.resultText}>{children}</View>
    </View>
  );
}

/** The main figure of a `ResultBox`, in its hue. */
export function ResultFigure({ hue = "brand", children }: { hue?: Hue; children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={[typography.title, tabular, { color: hueColors(theme, hue).base }]}>
      {children}
    </Text>
  );
}

/** A secondary line of a `ResultBox`. */
export function ResultDetail({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={[typography.callout, tabular, { color: theme.text, fontWeight: "600" }]}>
      {children}
    </Text>
  );
}

/** A short line led by a small glyph, e.g. days left or a status. */
export function IconLine({
  icon,
  color,
  children,
}: {
  icon: IconName;
  color?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  const tint = color ?? theme.muted;
  return (
    <View style={styles.iconLine}>
      <Ionicons
        name={icon}
        size={16}
        color={tint}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={[typography.subhead, styles.grow, { color: tint }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: { flex: 1, gap: 2, padding: spacing.md - 4, borderRadius: radius.md, borderWidth: 1 },
  statValue: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  statRow: { flexDirection: "row", gap: spacing.sm },
  result: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md - 4,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  resultText: { flex: 1, gap: 2 },
  iconLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  grow: { flex: 1 },
});
