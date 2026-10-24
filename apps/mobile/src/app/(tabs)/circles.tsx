import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { authClient, type AuthClient } from "@/auth/client";
import { AccountSection } from "@/components/AccountSection";
import { Section } from "@/components/ui";
import type { CirclesApi } from "@/circles/api";
import { CirclesHttpError, isUnauthorized } from "@/circles/api";
import { circlesApi } from "@/circles/client";
import { CirclesHome } from "@/circles/components/CirclesHome";
import { Onboarding } from "@/circles/components/Onboarding";
import { useLoad } from "@/circles/useLoad";
import { useTranslation } from "@/i18n";
import { Button, Hint, Panel } from "@/ramadhan/components/fields";
import { spacing, useTheme } from "@/theme";

export default function CirclesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: theme.text }]}>{t("circles.title")}</Text>
      {authClient && circlesApi ? (
        <SignedInGate client={authClient} api={circlesApi} />
      ) : (
        <Text style={{ color: theme.muted }}>{t("circles.unavailable")}</Text>
      )}
    </ScrollView>
  );
}

function SignedInGate({ client, api }: { client: AuthClient; api: CirclesApi }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { data: session, isPending } = client.useSession();

  if (isPending) return <Text style={{ color: theme.muted }}>{t("circles.loading")}</Text>;
  if (!session) {
    return (
      <View style={styles.stack}>
        <Section title={t("circles.signIn.title")}>
          <Panel>
            <Hint>{t("circles.signIn.body")}</Hint>
          </Panel>
        </Section>
        <AccountSection client={client} />
      </View>
    );
  }
  return <Loaded api={api} />;
}

function Loaded({ api }: { api: CirclesApi }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const state = useLoad(async () => {
    const config = await api.config();
    if (config.requiresPremium) return { config, profile: null, circles: [] };
    const profile = await api.getProfile();
    const circles = profile ? await api.list() : [];
    return { config, profile, circles };
  });

  if (state.error) {
    const key = state.error instanceof CirclesHttpError ? state.error.key : "generic";
    return (
      <View style={styles.stack}>
        <Text style={{ color: theme.text }}>
          {isUnauthorized(state.error) ? t("circles.signIn.title") : t(`circles.errors.${key}`)}
        </Text>
        <Button label={t("circles.retry")} onPress={() => void state.reload()} />
      </View>
    );
  }
  if (!state.data) return <Text style={{ color: theme.muted }}>{t("circles.loading")}</Text>;

  const { config, profile, circles } = state.data;
  if (config.requiresPremium) {
    return (
      <Section title={t("circles.premium.title")}>
        <Panel>
          <Hint>{t("circles.premium.body")}</Hint>
        </Panel>
      </Section>
    );
  }
  if (!profile) {
    return (
      <Onboarding
        api={api}
        onJoined={(id) => {
          void state.reload();
          router.push(`/circle/${id}`);
        }}
      />
    );
  }
  if (profile.suspended) {
    return <Text style={{ color: theme.text }}>{t("circles.errors.suspended")}</Text>;
  }
  return <CirclesHome api={api} profile={profile} circles={circles} reload={state.reload} />;
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  title: { fontSize: 28, fontWeight: "700" },
  stack: { gap: spacing.md },
});
