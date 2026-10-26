import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";

import { useQuranFont } from "@/hafalan/useQuranFont";
import { useTheme } from "@/theme";

/**
 * Arabic in the bundled Amiri Quran face, right to left, with room between lines for the harakat. Drawn exactly as stored
 * (the system Arabic font until Amiri has loaded). Read out as Arabic by screen readers that support it.
 */
export function ArabicText({
  children,
  size = 26,
  color,
  center,
  style,
}: {
  children: string;
  size?: number;
  color?: string;
  center?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();
  const { family } = useQuranFont();
  return (
    <Text
      accessibilityLanguage="ar"
      style={[
        styles.arabic,
        {
          fontFamily: family,
          fontSize: size,
          lineHeight: Math.round(size * 1.9),
          color: color ?? theme.text,
          textAlign: center ? "center" : "right",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  arabic: { writingDirection: "rtl" },
});
