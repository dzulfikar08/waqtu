import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card, IconChip } from "@/components/ui";
import { DEMO_MODE } from "@/demo/mode";
import { useTranslation } from "@/i18n";
import { Button } from "@/ramadhan/components/fields";
import { spacing, typography, useTheme } from "@/theme";

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
    <Card>
      <View style={styles.body}>
        <View style={styles.head}>
          <IconChip icon="diamond" size={44} color={theme.gold} background={theme.goldSoft} />
          <View style={styles.text}>
            <Text style={[typography.headline, { color: theme.text }]}>{t("premium.locked")}</Text>
            <Text style={[typography.subhead, { color: theme.muted }]}>
              {t("premium.lockedBody")}
            </Text>
          </View>
        </View>
        <Button
          block
          label={t("premium.see")}
          icon="sparkles"
          onPress={() => router.push("/premium")}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  text: { flex: 1, gap: 2 },
});
