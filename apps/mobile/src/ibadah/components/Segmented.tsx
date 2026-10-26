import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/ui";
import { hueColors, radius, typography, useTheme, type Hue } from "@/theme";

/** A row of mutually exclusive choices in a rounded track; the chosen one is filled with the section's colour. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  hue,
  accessibilityLabel,
}: {
  options: readonly { value: T; label: string; badge?: string }[];
  value: T;
  onChange: (value: T) => void;
  hue: Hue;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const colors = hueColors(theme, hue);
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: theme.surfaceAlt, borderColor: theme.separator }]}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <PressableScale
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={option.badge ? `${option.label}, ${option.badge}` : option.label}
            onPress={() => onChange(option.value)}
            scaleTo={0.96}
            style={[styles.option, on ? { backgroundColor: colors.base } : null]}
          >
            <Text
              numberOfLines={1}
              style={[
                typography.subhead,
                { color: on ? theme.surface : theme.text, fontWeight: on ? "700" : "500" },
              ]}
            >
              {option.label}
            </Text>
            {option.badge ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: on ? "rgba(255,255,255,0.25)" : colors.soft },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    typography.caption,
                    { color: on ? theme.surface : colors.base, fontWeight: "700" },
                  ]}
                >
                  {option.badge}
                </Text>
              </View>
            ) : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: 3,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 3,
  },
  option: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill },
});
