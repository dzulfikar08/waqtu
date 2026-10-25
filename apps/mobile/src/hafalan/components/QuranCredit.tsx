import { Ionicons } from "@expo/vector-icons";
import { Linking, Pressable, StyleSheet, Text } from "react-native";

import { useTranslation } from "@/i18n";
import { spacing, typography, useTheme } from "@/theme";

/** Tanzil's terms ask that the text's source is named and linked to tanzil.net. */
export function QuranCredit() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => void Linking.openURL("https://tanzil.net")}
      style={({ pressed }) => [styles.box, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons
        name="information-circle-outline"
        size={16}
        color={theme.faint}
        style={styles.icon}
      />
      <Text style={[typography.footnote, styles.text, { color: theme.muted }]}>
        {t("hafalan.credit")}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
  },
  icon: { alignSelf: "flex-start", marginTop: 1 },
  text: { flexShrink: 1, lineHeight: 18, textDecorationLine: "underline" },
});
