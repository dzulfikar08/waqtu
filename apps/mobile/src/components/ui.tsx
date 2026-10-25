import { Ionicons } from "@expo/vector-icons";
import { useState, type ComponentProps, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTabBarInset } from "@/components/tabbar/tabBarInset";
import { HIT, cardChrome, radius, spacing, tabular, typography, useTheme } from "@/theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Scale while pressed; 0.97 keeps it tactile without a visible jump. */
  scaleTo?: number;
};

/** Pressable with press feedback: shrinks a little and dims while held. Disabled controls rest at 45% opacity. */
export function PressableScale({
  style,
  children,
  scaleTo = 0.97,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const [progress] = useState(() => new Animated.Value(0));
  const resting = disabled ? 0.45 : 1;
  const animate = (toValue: number, duration: number) =>
    Animated.timing(progress, {
      toValue,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(event) => {
        animate(1, 100);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animate(0, 160);
        onPressOut?.(event);
      }}
      style={[
        style,
        {
          opacity: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [resting, resting * 0.8],
          }),
          transform: [
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] }) },
          ],
        },
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

/**
 * A tab screen: draws its own large title under the status bar (the tabs have no native header) and pads the end of
 * the content by what the floating tab bar covers, so the last card scrolls fully above it.
 */
export function Screen({
  title,
  eyebrow,
  caption,
  right,
  children,
}: {
  title: string;
  /** Small line above the title, e.g. the location. */
  eyebrow?: ReactNode;
  /** Line under the title, e.g. the Hijri date. */
  caption?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarInset();
  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[
          styles.screen,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: spacing.xl + Math.max(tabBar, insets.bottom),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderText}>
            {eyebrow}
            <Text
              accessibilityRole="header"
              style={[typography.largeTitle, { color: theme.text }]}
              numberOfLines={2}
            >
              {title}
            </Text>
            {caption}
          </View>
          {right}
        </View>
        {children}
      </ScrollView>
      {/* Edge-to-edge: content scrolls under the status bar, so the bar gets the page colour behind it. */}
      <View
        pointerEvents="none"
        style={[styles.statusBar, { height: insets.top, backgroundColor: theme.background }]}
      />
    </View>
  );
}

/** One soft card: white with a soft shadow on light, the popover green with a hairline on dark. */
export function Card({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** False for a card of rows that bring their own padding. */
  padded?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.card, cardChrome(theme), style]}>
      <View style={[styles.cardClip, padded ? styles.cardPadded : null]}>{children}</View>
    </View>
  );
}

/** Round tinted badge holding one glyph. Decorative: hidden from screen readers. */
export function IconChip({
  icon,
  color,
  background,
  size = 32,
}: {
  icon: IconName;
  color?: string;
  background?: string;
  size?: number;
}) {
  const theme = useTheme();
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: background ?? theme.accentSoft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={icon} size={Math.round(size * 0.55)} color={color ?? theme.accent} />
    </View>
  );
}

/** Uppercase label over a card, with an optional glyph and a right-hand detail. */
export function SectionTitle({
  title,
  icon,
  right,
}: {
  title: string;
  icon?: IconName;
  right?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.sectionHeader} accessibilityRole="header">
      {icon ? <Ionicons name={icon} size={15} color={theme.muted} /> : null}
      <Text style={[typography.overline, styles.grow, { color: theme.muted }]}>{title}</Text>
      {right}
    </View>
  );
}

/** A titled card of rows. The last row's separator is clipped by the card. */
export function Section({
  title,
  icon,
  right,
  footer,
  children,
}: {
  title: string;
  icon?: IconName;
  right?: ReactNode;
  /** Small print under the card. */
  footer?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <SectionTitle title={title} icon={icon} right={right} />
      <Card padded={false}>
        <View style={styles.rows}>{children}</View>
      </Card>
      {footer ? (
        <Text style={[typography.footnote, styles.footer, { color: theme.muted }]}>{footer}</Text>
      ) : null}
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        marginLeft: inset,
        backgroundColor: theme.separator,
      }}
    />
  );
}

/** A tappable list row: optional leading glyph, label (with a detail line), a value or a checkmark, and a chevron. */
export function Row({
  label,
  detail,
  value,
  icon,
  selected,
  onPress,
  disabled,
  destructive,
  chevron,
}: {
  label: string;
  detail?: string;
  value?: string;
  icon?: IconName;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
  /** Draws the trailing chevron of a row that opens another screen. */
  chevron?: boolean;
}) {
  const theme = useTheme();
  const tint = destructive ? theme.danger : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: theme.separator,
          backgroundColor: pressed ? theme.surfaceAlt : "transparent",
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      {icon ? (
        <IconChip
          icon={icon}
          size={30}
          color={destructive ? theme.danger : theme.accent}
          background={destructive ? theme.dangerSoft : theme.accentSoft}
        />
      ) : null}
      <View style={styles.rowText}>
        <Text style={[typography.body, { color: tint }]}>{label}</Text>
        {detail ? (
          <Text style={[typography.footnote, { color: theme.muted }]}>{detail}</Text>
        ) : null}
      </View>
      {value ? (
        <Text style={[typography.callout, tabular, { color: theme.muted }]}>{value}</Text>
      ) : null}
      {selected ? <Ionicons name="checkmark-circle" size={22} color={theme.accent} /> : null}
      {chevron ? <Ionicons name="chevron-forward" size={18} color={theme.faint} /> : null}
    </Pressable>
  );
}

/** Round − / + button with a visible fill and outline. */
export function StepButton({
  label,
  symbol,
  onPress,
  disabled,
}: {
  label: string;
  symbol: "−" | "+";
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.92}
      hitSlop={4}
      style={[styles.step, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}
    >
      <Ionicons name={symbol === "+" ? "add" : "remove"} size={20} color={theme.text} />
    </PressableScale>
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
  return (
    <View style={[styles.row, { borderColor: theme.separator }]}>
      <Text style={[typography.body, styles.rowText, { color: theme.text }]}>{label}</Text>
      <View style={styles.stepper}>
        <StepButton
          label={`${label} −`}
          symbol="−"
          disabled={value <= min}
          onPress={() => onChange(value - 1)}
        />
        <Text style={[styles.stepValue, tabular, { color: theme.text }]}>{format(value)}</Text>
        <StepButton
          label={`${label} +`}
          symbol="+"
          disabled={value >= max}
          onPress={() => onChange(value + 1)}
        />
      </View>
    </View>
  );
}

/** Round checkbox: an outlined ring when off, a filled accent disc with a check when on. */
export function CheckCircle({ checked, size = 26 }: { checked: boolean; size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: checked ? theme.accent : theme.border,
        backgroundColor: checked ? theme.accent : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {checked ? (
        <Ionicons name="checkmark" size={Math.round(size * 0.65)} color={theme.accentText} />
      ) : null}
    </View>
  );
}

/** A pill toggle: outlined when off, filled accent (with a check) when on. */
export function Pill({
  label,
  on,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
      scaleTo={0.95}
      style={[
        styles.pill,
        {
          borderColor: on ? theme.accent : theme.border,
          backgroundColor: on ? theme.accent : "transparent",
        },
      ]}
    >
      {on ? <Ionicons name="checkmark" size={14} color={theme.accentText} /> : null}
      <Text
        style={[
          typography.footnote,
          { color: on ? theme.accentText : theme.muted, fontWeight: "600" },
        ]}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: spacing.md + 4, gap: spacing.lg },
  fill: { flex: 1 },
  statusBar: { position: "absolute", top: 0, left: 0, right: 0, opacity: 0.96 },
  pageHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  pageHeaderText: { flex: 1, gap: 2 },
  card: { borderRadius: radius.lg },
  cardClip: { borderRadius: radius.lg, overflow: "hidden" },
  cardPadded: { padding: spacing.md + 2, gap: spacing.sm },
  rows: { marginBottom: -1 },
  section: { gap: spacing.sm },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.xs,
    minHeight: 20,
  },
  footer: { paddingHorizontal: spacing.xs },
  grow: { flex: 1 },
  row: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, gap: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  step: {
    width: HIT - 4,
    height: HIT - 4,
    borderRadius: (HIT - 4) / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: { minWidth: 32, textAlign: "center", fontSize: 17, fontWeight: "600" },
  pill: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
});
