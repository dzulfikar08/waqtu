import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { type AuthClient } from "@/auth/client";
import { appleSignInAvailable, signInWithApple, signInWithGoogle } from "@/auth/signIn";
import { Row, Section } from "@/components/ui";
import { useSyncState } from "@/hooks/useSyncState";
import { useTranslation } from "@/i18n";
import { usePremium } from "@/premium/usePremium";
import { syncNow } from "@/sync/run";
import { forgetAccount } from "@/sync/sqliteStore";
import { spacing, typography, useTheme } from "@/theme";

/** Rendered only when the auth server is configured, so there is never a dead sign-in button. */
export function AccountSection({ client }: { client: AuthClient }) {
  const db = useSQLiteContext();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const sync = useSyncState();
  const { data: session } = client.useSession();
  const { premium } = usePremium();
  const router = useRouter();
  const [apple, setApple] = useState(false);
  const [failed, setFailed] = useState(false);
  const [deleteError, setDeleteError] = useState<"stale" | "failed" | null>(null);

  useEffect(() => {
    void appleSignInAvailable().then(setApple);
  }, []);

  const syncLabel = () => {
    if (sync.status === "syncing") return t("sync.syncing");
    if (sync.status === "error") return t("sync.error");
    if (sync.lastSyncAt === null) return t("sync.idle");
    const time = new Intl.DateTimeFormat(i18n.language, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(sync.lastSyncAt);
    return `${t("sync.ok")} ${time}`;
  };

  const run = async (action: () => Promise<unknown>) => {
    setFailed(false);
    try {
      await action();
    } catch {
      setFailed(true);
    }
  };

  const deleteAccount = async () => {
    setDeleteError(null);
    try {
      const { error } = await client.deleteUser();
      if (error) {
        setDeleteError(error.code === "SESSION_EXPIRED" ? "stale" : "failed");
        return;
      }
      await forgetAccount(db);
    } catch {
      setDeleteError("failed");
    }
  };

  const confirmDelete = () =>
    Alert.alert(t("settings.deleteTitle"), t("settings.deleteBody"), [
      { text: t("settings.deleteCancel"), style: "cancel" },
      {
        text: t("settings.deleteConfirm"),
        style: "destructive",
        onPress: () => void deleteAccount(),
      },
    ]);

  return (
    <Section title={t("settings.account")} icon="person-circle">
      {session ? (
        <>
          <AccountHeader
            name={session.user.name}
            email={session.user.email}
            line={t("settings.signedInAs", { name: session.user.email || session.user.name })}
          />
          {premium ? (
            <Row
              label={`${t("sync.now")} · ${syncLabel()}`}
              icon="sync"
              onPress={() => void syncNow(db, client, session.user.id, true)}
              disabled={sync.status === "syncing"}
            />
          ) : (
            <Row
              label={t("sync.premium")}
              icon="diamond-outline"
              chevron
              onPress={() => router.push("/premium")}
            />
          )}
          <Row
            label={t("settings.signOut")}
            icon="log-out-outline"
            onPress={() => void run(() => client.signOut())}
          />
          <Row
            label={t("settings.deleteAccount")}
            icon="trash-outline"
            onPress={confirmDelete}
            destructive
          />
        </>
      ) : (
        <>
          {apple ? (
            <Row
              label={t("settings.signInApple")}
              icon="logo-apple"
              onPress={() => void run(() => signInWithApple(client))}
            />
          ) : null}
          <Row
            label={t("settings.signInGoogle")}
            icon="logo-google"
            onPress={() => void run(() => signInWithGoogle(client))}
          />
        </>
      )}
      {deleteError ? (
        <Text style={[typography.footnote, styles.note, { color: theme.danger }]}>
          {deleteError === "stale" ? t("settings.deleteStale") : t("settings.deleteFailed")}
        </Text>
      ) : null}
      {failed ? (
        <Text style={[typography.footnote, styles.note, { color: theme.muted }]}>
          {t("settings.signInFailed")}
        </Text>
      ) : null}
    </Section>
  );
}

/** The signed-in account: an initial in a round accent badge, the name and the signed-in line. */
function AccountHeader({ name, email, line }: { name: string; email: string; line: string }) {
  const theme = useTheme();
  const initial = (name || email).trim().charAt(0).toUpperCase() || "?";
  return (
    <View accessible style={[styles.header, { borderColor: theme.separator }]}>
      <View
        importantForAccessibility="no-hide-descendants"
        style={[styles.avatar, { backgroundColor: theme.accent }]}
      >
        <Text style={[typography.title, { color: theme.accentText }]}>{initial}</Text>
      </View>
      <View style={styles.headerText}>
        {name ? (
          <Text style={[typography.headline, { color: theme.text }]} numberOfLines={1}>
            {name}
          </Text>
        ) : null}
        <Text style={[typography.footnote, { color: theme.muted }]} numberOfLines={2}>
          {line}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 4,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, gap: 2 },
  note: { padding: spacing.md },
});
