import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { GlowHero, PREMIUM_HERO } from "@/components/GlowHero";
import { SectionTitle, type IconName } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { onSky, radius, spacing, typography } from "@/theme";

import { usePremium } from "./usePremium";

/** What a free account sees under the Premium card; the paywall lists the full set. */
const BENEFITS: { key: "sync" | "ramadhan"; icon: IconName }[] = [
  { key: "sync", icon: "sync" },
  { key: "ramadhan", icon: "moon" },
];

/** Settings entry for Waqtu Premium, a gold card; opens the paywall / subscription screen. */
export function PremiumSection() {
  const router = useRouter();
  const { t } = useTranslation();
  const { premium } = usePremium();
  const label = premium ? t("premium.settingsActive") : t("premium.settingsFree");
  return (
    <View style={styles.section}>
      <SectionTitle title={t("premium.settingsTitle")} icon="diamond" hue="ramadhan" />
      <GlowHero
        palette={PREMIUM_HERO}
        icon="diamond"
        title={t("premium.title")}
        body={label}
        onPress={() => router.push("/premium")}
      >
        {premium ? null : (
          <View style={styles.benefits}>
            {BENEFITS.map(({ key, icon }) => (
              <View key={key} style={[styles.benefit, { backgroundColor: onSky.glass }]}>
                <Ionicons name={icon} size={16} color={onSky.text} />
                <Text
                  style={[typography.footnote, styles.text, { color: onSky.text }]}
                  numberOfLines={2}
                >
                  {t(`premium.unlocks.${key}`)}
                </Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.more}>
          <Ionicons name="chevron-forward-circle" size={24} color={onSky.text} />
        </View>
      </GlowHero>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  text: { flex: 1, fontWeight: "600" },
  benefits: { gap: spacing.sm },
  benefit: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md - 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  more: { alignItems: "flex-end", marginTop: -spacing.xs },
});
