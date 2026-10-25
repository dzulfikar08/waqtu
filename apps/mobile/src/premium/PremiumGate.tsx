import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DEMO_MODE } from "@/demo/mode";
import { useTranslation } from "@/i18n";
import { radius, spacing, useTheme } from "@/theme";

import { usePremium } from "./usePremium";

/**
 * Shows `children` to premium accounts and a plain, dismissible explanation with a link to the
 * paywall to everyone else. Use around a whole premium feature, never around free core. The
 * store-screenshot build (DEMO_MODE) shows every feature, since the listing advertises them.
 */
export function PremiumGate({ children }: { children: ReactNode }) {
  const { premium } = usePremium();
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  if (premium || DEMO_MODE) return <>{children}</>;
  return (
    <View style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.text }]}>{t("premium.locked")}</Text>
      <Text style={{ color: theme.muted, fontSize: 15 }}>{t("premium.lockedBody")}</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push("/premium")}>
        <Text style={{ color: theme.accent, fontSize: 16, fontWeight: "600" }}>
          {t("premium.see")}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { fontSize: 17, fontWeight: "600" },
});
