import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { authClient, type AuthClient } from "@/auth/client";
import { AccountSection } from "@/components/AccountSection";
import { CIRCLES_HERO, GlowHero } from "@/components/GlowHero";
import { Card, IconChip, Screen, type IconName } from "@/components/ui";
import type { CirclesApi } from "@/circles/api";
import { CirclesHttpError, isUnauthorized } from "@/circles/api";
import { circlesApi } from "@/circles/client";
import { CirclesHome } from "@/circles/components/CirclesHome";
import { Onboarding } from "@/circles/components/Onboarding";
import { useLoad } from "@/circles/useLoad";
import { useTranslation } from "@/i18n";
import { PremiumGate } from "@/premium/PremiumGate";
import { Button } from "@/ramadhan/components/fields";
import { hueColors, hueWash, spacing, typography, useTheme } from "@/theme";

export default function CirclesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const backdrop = hueWash(theme, "circles");
  return (
    <Screen title={t("circles.tab")} backdrop={backdrop}>
      {authClient && circlesApi ? (
        <SignedInGate client={authClient} api={circlesApi} />
      ) : (
        <GlowHero palette={CIRCLES_HERO} icon="people" body={t("circles.unavailable")} />
      )}
    </Screen>
  );
}

/** A card holding one status line (loading, unavailable, an error) with its glyph. */
function Notice({
  icon,
  text,
  tone = "muted",
  children,
}: {
  icon: IconName;
  text: string;
  tone?: "muted" | "danger";
  children?: ReactNode;
}) {
  const theme = useTheme();
  const danger = tone === "danger";
  const hue = hueColors(theme, "circles");
  return (
    <Card hue={danger ? undefined : "circles"}>
      <View style={styles.notice}>
        <IconChip
          icon={icon}
          color={danger ? theme.danger : hue.base}
          background={danger ? theme.dangerSoft : hue.soft}
        />
        <Text
          style={[typography.callout, styles.grow, { color: danger ? theme.text : theme.muted }]}
        >
          {text}
        </Text>
      </View>
      {children}
    </Card>
  );
}

function SignedInGate({ client, api }: { client: AuthClient; api: CirclesApi }) {
  const { t } = useTranslation();
  const { data: session, isPending } = client.useSession();

  if (isPending) return <Notice icon="hourglass-outline" text={t("circles.loading")} />;
  if (!session) {
    return (
      <View style={styles.stack}>
        <GlowHero
          palette={CIRCLES_HERO}
          icon="people"
          title={t("circles.signIn.title")}
          body={t("circles.signIn.body")}
        />
        <AccountSection client={client} />
      </View>
    );
  }
  return <Loaded api={api} />;
}

function Loaded({ api }: { api: CirclesApi }) {
  const { t } = useTranslation();
  const router = useRouter();
  const state = useLoad(async () => {
    const config = await api.config();
    const profile = await api.getProfile();
    const circles = profile ? await api.list() : [];
    return { config, profile, circles };
  });

  if (state.error) {
    const key = state.error instanceof CirclesHttpError ? state.error.key : "generic";
    return (
      <Notice
        icon="alert-circle-outline"
        tone="danger"
        text={isUnauthorized(state.error) ? t("circles.signIn.title") : t(`circles.errors.${key}`)}
      >
        <Button label={t("circles.retry")} onPress={() => void state.reload()} />
      </Notice>
    );
  }
  if (!state.data) return <Notice icon="hourglass-outline" text={t("circles.loading")} />;

  const { config, profile, circles } = state.data;
  const content = !profile ? (
    <Onboarding
      api={api}
      onJoined={(id) => {
        void state.reload();
        router.push(`/circle/${id}`);
      }}
    />
  ) : profile.suspended ? (
    <Notice icon="ban-outline" tone="danger" text={t("circles.errors.suspended")} />
  ) : (
    <CirclesHome api={api} profile={profile} circles={circles} reload={state.reload} />
  );
  // Circles are Premium: the server refuses joins and posts with `premium_required` while
  // `CIRCLES_REQUIRES_PREMIUM` is on, which it always is in production.
  return config.requiresPremium ? <PremiumGate>{content}</PremiumGate> : content;
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  notice: { flexDirection: "row", alignItems: "center", gap: spacing.md - 4 },
  grow: { flex: 1 },
});
