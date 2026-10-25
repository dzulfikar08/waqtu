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
  TextInput,
  View,
} from "react-native";

import { authClient } from "@/auth/client";
import { circlesApi } from "@/circles/client";
import { Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
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
import { radius, spacing, useTheme } from "@/theme";

/** The site serves Indonesian at the root and English under /en. */
const legalUrl = (page: "privacy" | "terms", language: string) =>
  `https://getwaqtu.com${language.startsWith("id") ? "" : "/en"}/${page}`;
/** Exactly the features wrapped in `PremiumGate` (or, for sync, checked in `SyncController`). */
const UNLOCK_KEYS = ["sync", "ramadhan"] as const;

type Message = { text: string; tone: "ok" | "problem" };

export default function PremiumScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { premium, entitlement, userId } = usePremium();
  const [plans, setPlans] = useState<Plans | null>(null);
  const [plansFailed, setPlansFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [licenseKey, setLicenseKey] = useState("");
  const [circlesPremium, setCirclesPremium] = useState(false);

  const api = authClient && userId ? premiumApiFor(authClient) : null;
  const store = t(Platform.OS === "ios" ? "premium.storeApple" : "premium.storeGoogle");
  const lifetime = premium && entitlement?.expiresAt === null;

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

  // Circles join the list only while the server switch `CIRCLES_REQUIRES_PREMIUM` is on.
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

  const linkLicense = () =>
    run(async () => {
      if (!api || !userId || licenseKey.trim() === "") return null;
      try {
        await storeEntitlement(db, userId, await api.linkLicense(licenseKey.trim()));
      } catch (error) {
        if (error instanceof PremiumApiError) {
          if (error.code === "invalid_license") {
            return { text: t("premium.licenseInvalid"), tone: "problem" };
          }
          if (error.code === "license_unreachable") {
            return { text: t("premium.licenseUnreachable"), tone: "problem" };
          }
          if (error.code === "linked_to_other_account") {
            return { text: t("premium.linkedElsewhere"), tone: "problem" };
          }
        }
        throw error;
      }
      setLicenseKey("");
      return { text: t("premium.licenseLinked"), tone: "ok" };
    });

  const date = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" }).format(new Date(iso));

  const status = () => {
    if (lifetime) return t("premium.statusLifetime");
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
      case "license":
        return t("premium.sourceLicense");
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
      <Pressable
        key={plan}
        accessibilityRole="button"
        accessibilityLabel={t("premium.subscribe", { plan: name })}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => void subscribe(plan)}
        style={[styles.plan, { backgroundColor: theme.accent, opacity: busy ? 0.5 : 1 }]}
      >
        <Text style={[styles.planName, { color: theme.accentText }]}>
          {t("premium.subscribe", { plan: name })}
        </Text>
        <Text style={{ color: theme.accentText, fontSize: 15 }}>{price}</Text>
      </Pressable>
    );
  };

  const link = (label: string, url: string) => (
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(url)}>
      <Text style={[styles.link, { color: theme.accent }]}>{label}</Text>
    </Pressable>
  );

  const secondary = (label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={[styles.secondary, { borderColor: theme.border, opacity: busy ? 0.5 : 1 }]}
    >
      <Text style={{ color: theme.text, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: t("premium.title"),
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
        }}
      />
      <Text style={[styles.intro, { color: theme.text }]}>{t("premium.intro")}</Text>

      <Section title={t("premium.unlocksTitle")}>
        {unlocks.map((key) => (
          <View key={key} style={[styles.bullet, { borderColor: theme.border }]}>
            <Text style={{ color: theme.text, fontSize: 16 }}>{t(`premium.unlocks.${key}`)}</Text>
          </View>
        ))}
      </Section>

      <Section title={t("premium.freeTitle")}>
        <View style={styles.bullet}>
          <Text style={{ color: theme.text, fontSize: 16 }}>{t("premium.free")}</Text>
        </View>
      </Section>

      <View style={styles.block}>
        <Text style={[styles.status, { color: theme.text }]}>{status()}</Text>
        {premium && sourceLabel() ? (
          <Text style={{ color: theme.muted, fontSize: 14 }}>{sourceLabel()}</Text>
        ) : null}
        {message ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: message.tone === "ok" ? theme.accent : theme.text, fontSize: 15 }}
          >
            {message.text}
          </Text>
        ) : null}
      </View>

      {!userId ? (
        <View style={styles.block}>
          <Text style={{ color: theme.text, fontSize: 15 }}>{t("premium.signInFirst")}</Text>
          {secondary(t("premium.signIn"), () => router.push("/settings"))}
        </View>
      ) : null}

      {userId && !premium ? (
        <View style={styles.block}>
          {!STORE_AVAILABLE ? (
            <Text style={{ color: theme.muted }}>{t("premium.storeUnavailable")}</Text>
          ) : plansFailed ? (
            <>
              <Text style={{ color: theme.muted }}>{t("premium.plansUnavailable")}</Text>
              {secondary(t("premium.retry"), reloadPlans)}
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
          {secondary(t("premium.restore"), () => void restore())}
          {premium && (entitlement?.source === "apple" || entitlement?.source === "google")
            ? secondary(t("premium.manage"), () => void openManageSubscriptions().catch(() => {}))
            : null}
        </View>
      ) : null}

      {STORE_AVAILABLE ? (
        <View style={styles.block}>
          <Text style={{ color: theme.muted, fontSize: 13 }}>{t("premium.terms", { store })}</Text>
          <View style={styles.links}>
            {link(t("premium.privacy"), legalUrl("privacy", i18n.language))}
            {link(t("premium.termsLink"), legalUrl("terms", i18n.language))}
          </View>
        </View>
      ) : null}

      {userId && !lifetime ? (
        <Section title={t("premium.licenseTitle")}>
          <View style={styles.block}>
            <Text style={{ color: theme.muted, fontSize: 14 }}>{t("premium.licenseBody")}</Text>
            <TextInput
              value={licenseKey}
              onChangeText={setLicenseKey}
              placeholder={t("premium.licensePlaceholder")}
              placeholderTextColor={theme.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            />
            {secondary(t("premium.licenseLink"), () => void linkLicense())}
          </View>
        </Section>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.lg },
  intro: { fontSize: 16, lineHeight: 23 },
  bullet: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  block: { gap: spacing.sm },
  status: { fontSize: 17, fontWeight: "600" },
  plan: {
    minHeight: 56,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    justifyContent: "center",
    gap: 2,
  },
  planName: { fontSize: 17, fontWeight: "600" },
  secondary: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  links: { flexDirection: "row", gap: spacing.md },
  link: { fontSize: 14, textDecorationLine: "underline" },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
});
