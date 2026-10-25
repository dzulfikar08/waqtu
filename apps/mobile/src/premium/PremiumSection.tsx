import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { IconChip, PressableScale, SectionTitle, type IconName } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { cardChrome, radius, spacing, typography, useTheme } from "@/theme";

import { usePremium } from "./usePremium";

/** What a free account sees under the Premium card; the paywall lists the full set. */
const BENEFITS: { key: "sync" | "ramadhan"; icon: IconName }[] = [
  { key: "sync", icon: "sync" },
  { key: "ramadhan", icon: "moon" },
];

/** Settings entry for Waqtu Premium; opens the paywall / subscription screen. */
export function PremiumSection() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const { premium } = usePremium();
  const label = premium ? t("premium.settingsActive") : t("premium.settingsFree");
  return (
    <View style={styles.section}>
      <SectionTitle title={t("premium.settingsTitle")} icon="diamond" />
      <PressableScale
        accessibilityRole="button"
        onPress={() => router.push("/premium")}
        style={[styles.card, cardChrome(theme), { borderColor: theme.gold, borderWidth: 1 }]}
      >
        <View style={styles.head}>
          <IconChip icon="diamond" size={44} color={theme.gold} background={theme.goldSoft} />
          <View style={styles.text}>
            <Text style={[typography.headline, { color: theme.text }]}>{t("premium.title")}</Text>
            <Text style={[typography.subhead, { color: premium ? theme.gold : theme.muted }]}>
              {label}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.faint} />
        </View>
        {premium ? null : (
          <View style={[styles.benefits, { borderColor: theme.separator }]}>
            {BENEFITS.map(({ key, icon }) => (
              <View key={key} style={styles.benefit}>
                <Ionicons name={icon} size={16} color={theme.gold} />
                <Text
                  style={[typography.footnote, styles.text, { color: theme.muted }]}
                  numberOfLines={2}
                >
                  {t(`premium.unlocks.${key}`)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  card: { borderRadius: radius.lg, padding: spacing.md + 2, gap: spacing.md },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md - 4 },
  text: { flex: 1, gap: 2 },
  benefits: {
    gap: spacing.sm,
    paddingTop: spacing.md - 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  benefit: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
});
