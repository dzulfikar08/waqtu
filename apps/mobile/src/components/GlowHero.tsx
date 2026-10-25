import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { HeroGlow } from "@/components/HeroGlow";
import { PressableScale, type IconName } from "@/components/ui";
import { onSky, radius, spacing, typography, useTheme } from "@/theme";

/** A hero's gradient, top-left to bottom-right: [light stops, dark stops]; dark is the same colours, dimmed. */
export interface HeroPalette {
  light: readonly string[];
  dark: readonly string[];
}

/** Circles: rose into violet. */
export const CIRCLES_HERO: HeroPalette = {
  light: ["#D1416A", "#7C4DCC"],
  dark: ["#4A1A2E", "#2E1F52"],
};

/** Premium: deep gold into champagne. */
export const PREMIUM_HERO: HeroPalette = {
  light: ["#B07828", "#D4A574", "#F2D19B"],
  dark: ["#3A2A12", "#5A4220"],
};

function gradient(stops: readonly string[], angle = 150): string {
  const last = stops.length - 1;
  return `linear-gradient(${angle}deg, ${stops
    .map((stop, index) => `${stop} ${Math.round((index / last) * 100)}%`)
    .join(", ")})`;
}

/**
 * An inviting gradient card: a large glyph in softly breathing glass rings in the top-right corner, white title and
 * body, and its actions (`children`) underneath. The art is hidden from screen readers. With `onPress` the whole card
 * is one button.
 */
export function GlowHero({
  palette,
  icon,
  title,
  body,
  onPress,
  children,
}: {
  palette: HeroPalette;
  icon: IconName;
  title?: string;
  body?: string;
  onPress?: () => void;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const chrome: StyleProp<ViewStyle> = [
    styles.hero,
    {
      experimental_backgroundImage: gradient(theme.dark ? palette.dark : palette.light),
      boxShadow: theme.dark
        ? "0 10px 24px -12px rgba(0,0,0,0.6)"
        : `0 14px 28px -14px ${palette.light[0]}`,
    },
  ];
  const content = (
    <>
      <HeroArt icon={icon} />
      <View style={styles.head}>
        {title ? (
          <Text
            accessibilityRole={onPress ? undefined : "header"}
            style={[typography.title, { color: onSky.text }]}
          >
            {title}
          </Text>
        ) : null}
        {body ? (
          <Text
            style={[
              title ? typography.subhead : typography.headline,
              { color: onSky.text, opacity: title ? 0.9 : 1, lineHeight: title ? 20 : 22 },
            ]}
          >
            {body}
          </Text>
        ) : null}
      </View>
      {children}
    </>
  );
  return onPress ? (
    <PressableScale accessibilityRole="button" onPress={onPress} scaleTo={0.98} style={chrome}>
      {content}
    </PressableScale>
  ) : (
    <View style={chrome}>{content}</View>
  );
}

/** The corner art: the glow and breathing rings, with the glyph in a frosted disc. */
function HeroArt({ icon }: { icon: IconName }) {
  return (
    <HeroGlow breathe>
      <View style={[styles.disc, { backgroundColor: onSky.glass, borderColor: onSky.line }]}>
        <View style={[styles.discInner, { backgroundColor: onSky.glassStrong }]}>
          <Ionicons name={icon} size={34} color={onSky.text} />
        </View>
      </View>
    </HeroGlow>
  );
}

/** A button on a hero card: solid white with the hero's colour (primary) or frosted glass. */
export function HeroButton({
  label,
  icon,
  onPress,
  primary,
  palette,
  disabled,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  primary?: boolean;
  palette: HeroPalette;
  disabled?: boolean;
}) {
  const color = primary ? palette.light[0] : onSky.text;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        primary
          ? { backgroundColor: onSky.text, borderColor: onSky.text }
          : { backgroundColor: onSky.shade, borderColor: onSky.line },
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={color} /> : null}
      <Text style={[typography.callout, { color, fontWeight: "700" }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.lg + 4,
    padding: spacing.md + 4,
    gap: spacing.md,
    overflow: "hidden",
  },
  head: { gap: spacing.xs, paddingRight: 92, minHeight: 72, justifyContent: "center" },
  disc: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  discInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    minHeight: 46,
    alignSelf: "stretch",
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
});
