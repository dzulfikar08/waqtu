import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { type AuthClient } from "@/auth/client";
import type { EmailSignInProblem } from "@/auth/emailSignIn";
import {
  appleSignInAvailable,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
} from "@/auth/signIn";
import { TextField } from "@/circles/components/TextField";
import { CIRCLES_HERO } from "@/components/GlowHero";
import { Row, Section } from "@/components/ui";
import { useSyncState } from "@/hooks/useSyncState";
import { useTranslation } from "@/i18n";
import { usePremium } from "@/premium/usePremium";
import { Button, ButtonRow, Hint, Panel } from "@/ramadhan/components/fields";
import { syncNow } from "@/sync/run";
import { forgetAccount } from "@/sync/sqliteStore";
import { HIT, onSky, spacing, typography, useTheme } from "@/theme";

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
    <Section title={t("settings.account")} icon="person-circle" hue="circles">
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
              hue="circles"
              onPress={() => void syncNow(db, client, session.user.id, true)}
              disabled={sync.status === "syncing"}
            />
          ) : (
            <Row
              label={t("sync.premium")}
              icon="diamond-outline"
              hue="ramadhan"
              chevron
              onPress={() => router.push("/premium")}
            />
          )}
          <Row
            label={t("settings.signOut")}
            icon="log-out-outline"
            hue="circles"
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
              hue="circles"
              onPress={() => void run(() => signInWithApple(client))}
            />
          ) : null}
          <Row
            label={t("settings.signInGoogle")}
            icon="logo-google"
            hue="circles"
            onPress={() => void run(() => signInWithGoogle(client))}
          />
          <ReviewerSignIn client={client} />
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

const PROBLEM_KEYS = {
  missing: "settings.reviewerMissing",
  invalid: "settings.reviewerInvalid",
  rateLimited: "settings.reviewerRateLimited",
  failed: "settings.reviewerFailed",
} as const satisfies Record<EmailSignInProblem, string>;

/**
 * Email + password sign-in for store reviewers (Google Play, App Store) behind a quiet link: the server
 * only accepts the reviewer accounts it was configured with, and nobody can sign up this way.
 */
function ReviewerSignIn({ client }: { client: AuthClient }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<EmailSignInProblem | null>(null);

  if (!open) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={styles.reviewerLink}
      >
        <Text style={[typography.footnote, { color: theme.muted }]}>
          {t("settings.reviewerLink")}
        </Text>
      </Pressable>
    );
  }

  const submit = async () => {
    setBusy(true);
    setProblem(null);
    const result = await signInWithEmail(client, email, password);
    setBusy(false);
    setProblem(result);
    if (result === null) setPassword("");
  };

  return (
    <Panel>
      <TextField
        accessibilityLabel={t("settings.reviewerEmail")}
        placeholder={t("settings.reviewerEmail")}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
        returnKeyType="next"
        value={email}
        onChangeText={setEmail}
      />
      <TextField
        accessibilityLabel={t("settings.reviewerPassword")}
        placeholder={t("settings.reviewerPassword")}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        secureTextEntry
        textContentType="password"
        returnKeyType="go"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={() => void submit()}
      />
      {problem ? <Hint>{t(PROBLEM_KEYS[problem])}</Hint> : null}
      <ButtonRow>
        <Button
          label={t("settings.reviewerSubmit")}
          disabled={busy}
          onPress={() => void submit()}
        />
        <Button
          tone="plain"
          label={t("settings.reviewerCancel")}
          disabled={busy}
          onPress={() => {
            setOpen(false);
            setPassword("");
            setProblem(null);
          }}
        />
      </ButtonRow>
    </Panel>
  );
}

/** The signed-in account: an initial in a round rose-to-violet badge, the name and the signed-in line. */
function AccountHeader({ name, email, line }: { name: string; email: string; line: string }) {
  const theme = useTheme();
  const initial = (name || email).trim().charAt(0).toUpperCase() || "?";
  const stops = theme.dark ? CIRCLES_HERO.dark : CIRCLES_HERO.light;
  return (
    <View accessible style={[styles.header, { borderColor: theme.separator }]}>
      <View
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.avatar,
          {
            experimental_backgroundImage: `linear-gradient(135deg, ${stops[0]} 0%, ${stops[1]} 100%)`,
          },
        ]}
      >
        <Text style={[typography.title, { color: onSky.text }]}>{initial}</Text>
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
  reviewerLink: {
    minHeight: HIT,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
});
