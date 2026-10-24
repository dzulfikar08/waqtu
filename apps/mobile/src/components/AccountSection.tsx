import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Alert, Text } from "react-native";

import { type AuthClient } from "@/auth/client";
import { appleSignInAvailable, signInWithApple, signInWithGoogle } from "@/auth/signIn";
import { Row, Section } from "@/components/ui";
import { useSyncState } from "@/hooks/useSyncState";
import { useTranslation } from "@/i18n";
import { syncNow } from "@/sync/run";
import { forgetAccount } from "@/sync/sqliteStore";
import { spacing, useTheme } from "@/theme";

/** Rendered only when the auth server is configured, so there is never a dead sign-in button. */
export function AccountSection({ client }: { client: AuthClient }) {
  const db = useSQLiteContext();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const sync = useSyncState();
  const { data: session } = client.useSession();
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
    <Section title={t("settings.account")}>
      {session ? (
        <>
          <Row
            label={t("settings.signedInAs", { name: session.user.email || session.user.name })}
            onPress={() => {}}
            disabled
          />
          <Row
            label={`${t("sync.now")} · ${syncLabel()}`}
            onPress={() => void syncNow(db, client, session.user.id, true)}
            disabled={sync.status === "syncing"}
          />
          <Row label={t("settings.signOut")} onPress={() => void run(() => client.signOut())} />
          <Row label={t("settings.deleteAccount")} onPress={confirmDelete} destructive />
        </>
      ) : (
        <>
          {apple ? (
            <Row
              label={t("settings.signInApple")}
              onPress={() => void run(() => signInWithApple(client))}
            />
          ) : null}
          <Row
            label={t("settings.signInGoogle")}
            onPress={() => void run(() => signInWithGoogle(client))}
          />
        </>
      )}
      {deleteError ? (
        <Text style={{ color: theme.danger, padding: spacing.md }}>
          {deleteError === "stale" ? t("settings.deleteStale") : t("settings.deleteFailed")}
        </Text>
      ) : null}
      {failed ? (
        <Text style={{ color: theme.muted, padding: spacing.md }}>
          {t("settings.signInFailed")}
        </Text>
      ) : null}
    </Section>
  );
}
