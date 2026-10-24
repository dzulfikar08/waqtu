import { Linking, Pressable, StyleSheet, Text } from "react-native";

import { useTranslation } from "@/i18n";
import { spacing, useTheme } from "@/theme";

/** Tanzil's terms ask that the text's source is named and linked to tanzil.net. */
export function QuranCredit() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => void Linking.openURL("https://tanzil.net")}
      style={styles.box}
    >
      <Text style={[styles.text, { color: theme.muted }]}>{t("hafalan.credit")}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
  text: { fontSize: 13, lineHeight: 18, textDecorationLine: "underline" },
});
