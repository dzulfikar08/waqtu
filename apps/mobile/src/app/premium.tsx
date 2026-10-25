import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { authClient } from "@/auth/client";
import { circlesApi } from "@/circles/client";
import { GlowHero, PREMIUM_HERO } from "@/components/GlowHero";
import { Card, IconChip, PressableScale, Section, type IconName } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { Button } from "@/ramadhan/components/fields";
import { PremiumApiError } from "@/premium/api";
import type { Plan } from "@/premium/entitlement";
import { purchasePlan, restorePurchases } from "@/premium/purchase";
import { storeEntitlement } from "@/premium/state";
import {
  AlreadySubscribedError,
  loadPlans,
  openManageSubscriptions,
  STORE_AVAILABLE,
  type Plans,
} from "@/premium/store";
import { premiumApiFor, usePremium } from "@/premium/usePremium";
import { HIT, radius, spacing, tabular, typography, useTheme } from "@/theme";

/** The site serves Indonesian at the root and English under /en. */
const legalUrl = (page: "privacy" | "terms", language: string) =>
  `https://getwaqtu.com${language.startsWith("id") ? "" : "/en"}/${page}`;
/** Exactly the features wrapped in `PremiumGate` (or, for sync, checked in `SyncController`). */
const UNLOCK_KEYS = ["sync", "ramadhan"] as const;
const UNLOCK_ICONS: Record<(typeof UNLOCK_KEYS)[number] | "circles", IconName> = {
  sync: "sync",
  ramadhan: "moon",
  circles: "people",
};

type Message = { text: string; tone: "ok" | "problem" };

export default function PremiumScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { premium, entitlement, userId } = usePremium();
  const [plans, setPlans] = useState<Plans | null>(null);
  const [plansFailed, setPlansFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  // Circles are Premium; the server's `requiresPremium` (from `CIRCLES_REQUIRES_PREMIUM`) can drop them.
  const [circlesPremium, setCirclesPremium] = useState(true);

  const api = authClient && userId ? premiumApiFor(authClient) : null;
  const store = t(Platform.OS === "ios" ? "premium.storeApple" : "premium.storeGoogle");

  const reloadPlans = useCallback(() => {
    setPlansFailed(false);
    loadPlans()
      .then((loaded) => {
        setPlans(loaded);
        setPlansFailed(Object.keys(loaded).length === 0);
      })
      .catch(() => setPlansFailed(true));
  }, []);

  useEffect(() => {
    if (STORE_AVAILABLE && !premium) reloadPlans();
  }, [premium, reloadPlans]);

  // Circles leave the list only if the server reports `CIRCLES_REQUIRES_PREMIUM` off.
  useEffect(() => {
    if (!circlesApi || !userId) return;
    let live = true;
    circlesApi
      .config()
      .then((config) => {
        if (live) setCirclesPremium(config.requiresPremium);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [userId]);
  const unlocks = circlesPremium ? [...UNLOCK_KEYS, "circles" as const] : UNLOCK_KEYS;

  const problem = (error: unknown): Message => {
    if (error instanceof AlreadySubscribedError) {
      return { text: t("premium.alreadyOwned"), tone: "problem" };
    }
    if (error instanceof PremiumApiError) {
      if (error.code === "linked_to_other_account") {
        return { text: t("premium.linkedElsewhere"), tone: "problem" };
      }
      if (error.code === "invalid_receipt") {
        return { text: t("premium.invalidReceipt"), tone: "problem" };
      }
    }
    return { text: t("premium.failed"), tone: "problem" };
  };

  const run = async (action: () => Promise<Message | null>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await action());
    } catch (error) {
      setMessage(problem(error));
    } finally {
      setBusy(false);
    }
  };

  const subscribe = (plan: Plan) =>
    run(async () => {
      if (!api || !userId) return null;
      const result = await purchasePlan(api, plan, userId);
      if (result.status === "cancelled") return null;
      if (result.status === "pending") return { text: t("premium.pending"), tone: "ok" };
      await storeEntitlement(db, userId, result.entitlement);
      return { text: t("premium.thanks"), tone: "ok" };
    });

  const restore = () =>
    run(async () => {
      if (!api || !userId) return null;
      const restored = await restorePurchases(api, true);
      if (restored.entitlement) await storeEntitlement(db, userId, restored.entitlement);
      if (restored.entitlement?.premium) return { text: t("premium.restored"), tone: "ok" };
      if (restored.rejected) return problem(restored.rejected);
      return { text: t("premium.nothingToRestore"), tone: "ok" };
    });

  const date = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" }).format(new Date(iso));

  const status = () => {
    if (premium && !entitlement?.expiresAt) return t("premium.statusActive");
    if (premium && entitlement?.expiresAt) {
      return t("premium.statusActiveUntil", { date: date(entitlement.expiresAt) });
    }
    if (entitlement?.source && entitlement.expiresAt) {
      return t("premium.statusLapsed", { date: date(entitlement.expiresAt) });
    }
    return t("premium.statusFree");
  };

  const sourceLabel = () => {
    switch (entitlement?.source) {
      case "apple":
        return t("premium.sourceApple");
      case "google":
        return t("premium.sourceGoogle");
      case "polar":
        return t("premium.sourcePolar");
      default:
        return null;
    }
  };

  const planButton = (plan: Plan) => {
    const offer = plans?.[plan];
    if (!offer) return null;
    const name = t(plan === "monthly" ? "premium.monthly" : "premium.yearly");
    const price = t(plan === "monthly" ? "premium.perMonth" : "premium.perYear", {
      price: offer.displayPrice,
    });
    return (
      <PressableScale
        key={plan}
        accessibilityRole="button"
        accessibilityLabel={t("premium.subscribe", { plan: name })}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => void subscribe(plan)}
        style={[styles.plan, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}
      >
        <View style={styles.grow}>
          <Text style={[typography.headline, { color: theme.text }]}>
            {t("premium.subscribe", { plan: name })}
          </Text>
          <Text style={[typography.callout, tabular, { color: theme.muted }]}>{price}</Text>
        </View>
        {plan === "yearly" ? <Ionicons name="star" size={18} color={theme.gold} /> : null}
        <Ionicons name="chevron-forward" size={18} color={theme.accent} />
      </PressableScale>
    );
  };

  const link = (label: string, url: string) => (
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(url)}>
      <Text style={[styles.link, { color: theme.accent }]}>{label}</Text>
    </Pressable>
  );

  const secondary = (label: string, onPress: () => void, icon?: IconName) => (
    <Button block label={label} icon={icon} tone="plain" disabled={busy} onPress={onPress} />
  );

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: t("premium.title"),
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      />
      <GlowHero
        palette={PREMIUM_HERO}
        icon="diamond"
        title={t("premium.title")}
        body={t("premium.intro")}
      />

      <Section title={t("premium.unlocksTitle")} icon="sparkles" hue="ramadhan">
        {unlocks.map((key) => (
          <View key={key} style={[styles.bullet, { borderColor: theme.separator }]}>
            <IconChip
              icon={UNLOCK_ICONS[key]}
              size={30}
              color={theme.gold}
              background={theme.goldSoft}
            />
            <Text style={[typography.callout, styles.grow, { color: theme.text }]}>
              {t(`premium.unlocks.${key}`)}
            </Text>
          </View>
        ))}
      </Section>

      <Section title={t("premium.freeTitle")} icon="heart" hue="brand">
        <View style={[styles.bullet, { borderColor: theme.separator }]}>
          <IconChip icon="checkmark" size={30} />
          <Text style={[typography.callout, styles.grow, { color: theme.text }]}>
            {t("premium.free")}
          </Text>
        </View>
      </Section>

      <Card>
        <View style={styles.status}>
          <Ionicons
            name={premium ? "checkmark-circle" : "person-circle-outline"}
            size={24}
            color={premium ? theme.accent : theme.muted}
          />
          <View style={styles.grow}>
            <Text style={[typography.headline, { color: theme.text }]}>{status()}</Text>
            {premium && sourceLabel() ? (
              <Text style={[typography.subhead, { color: theme.muted }]}>{sourceLabel()}</Text>
            ) : null}
            {message ? (
              <Text
                accessibilityLiveRegion="polite"
                style={[
                  typography.callout,
                  { color: message.tone === "ok" ? theme.accent : theme.danger },
                ]}
              >
                {message.text}
              </Text>
            ) : null}
          </View>
        </View>
      </Card>

      {!userId ? (
        <View style={styles.block}>
          <Text style={[typography.callout, { color: theme.text }]}>
            {t("premium.signInFirst")}
          </Text>
          {secondary(t("premium.signIn"), () => router.push("/settings"), "settings-outline")}
        </View>
      ) : null}

      {userId && !premium ? (
        <View style={styles.block}>
          {!STORE_AVAILABLE ? (
            <Text style={[typography.callout, { color: theme.muted }]}>
              {t("premium.storeUnavailable")}
            </Text>
          ) : plansFailed ? (
            <>
              <Text style={[typography.callout, { color: theme.muted }]}>
                {t("premium.plansUnavailable")}
              </Text>
              {secondary(t("premium.retry"), reloadPlans, "refresh")}
            </>
          ) : plans === null ? (
            <ActivityIndicator color={theme.accent} />
          ) : (
            <>
              {planButton("monthly")}
              {planButton("yearly")}
            </>
          )}
        </View>
      ) : null}

      {userId && STORE_AVAILABLE ? (
        <View style={styles.block}>
          {secondary(t("premium.restore"), () => void restore(), "refresh")}
          {premium && (entitlement?.source === "apple" || entitlement?.source === "google")
            ? secondary(
                t("premium.manage"),
                () => void openManageSubscriptions().catch(() => {}),
                "card-outline",
              )
            : null}
        </View>
      ) : null}

      {STORE_AVAILABLE ? (
        <View style={styles.block}>
          <Text style={[typography.footnote, { color: theme.muted }]}>
            {t("premium.terms", { store })}
          </Text>
          <View style={styles.links}>
            {link(t("premium.privacy"), legalUrl("privacy", i18n.language))}
            {link(t("premium.termsLink"), legalUrl("terms", i18n.language))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md + 4, paddingTop: spacing.md, gap: spacing.lg },
  grow: { flex: 1, gap: 2 },
  bullet: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  block: { gap: spacing.sm + 4 },
  status: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md - 4 },
  plan: {
    minHeight: HIT + 20,
    borderRadius: radius.lg,
    borderWidth: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 4,
  },
  links: { flexDirection: "row", gap: spacing.md },
  link: { ...typography.subhead, textDecorationLine: "underline" },
});
