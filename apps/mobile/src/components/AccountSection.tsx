import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Text } from "react-native";

import { type AuthClient } from "@/auth/client";
import { appleSignInAvailable, signInWithApple, signInWithGoogle } from "@/auth/signIn";
import { Row, Section } from "@/components/ui";
import { useSyncState } from "@/hooks/useSyncState";
import { useTranslation } from "@/i18n";
import { syncNow } from "@/sync/run";
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
      {failed ? (
        <Text style={{ color: theme.muted, padding: spacing.md }}>
          {t("settings.signInFailed")}
        </Text>
      ) : null}
    </Section>
  );
}
