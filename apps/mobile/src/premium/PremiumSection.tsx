import { useRouter } from "expo-router";

import { Row, Section } from "@/components/ui";
import { useTranslation } from "@/i18n";

import { usePremium } from "./usePremium";

/** Settings entry for Waqtu Premium; opens the paywall / subscription screen. */
export function PremiumSection() {
  const router = useRouter();
  const { t } = useTranslation();
  const { premium } = usePremium();
  const label = premium ? t("premium.settingsActive") : t("premium.settingsFree");
  return (
    <Section title={t("premium.settingsTitle")}>
      <Row label={label} onPress={() => router.push("/premium")} />
    </Section>
  );
}
