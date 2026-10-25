import { useRouter } from "expo-router";
import type { ReactNode } from "react";

import { GlowHero, HeroButton, PREMIUM_HERO } from "@/components/GlowHero";
import { DEMO_MODE } from "@/demo/mode";
import { useTranslation } from "@/i18n";

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
  if (premium || DEMO_MODE) return <>{children}</>;
  return (
    <GlowHero
      palette={PREMIUM_HERO}
      icon="diamond"
      title={t("premium.locked")}
      body={t("premium.lockedBody")}
    >
      <HeroButton
        primary
        palette={PREMIUM_HERO}
        label={t("premium.see")}
        icon="sparkles"
        onPress={() => router.push("/premium")}
      />
    </GlowHero>
  );
}
