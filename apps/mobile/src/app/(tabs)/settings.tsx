import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Linking, ScrollView, StyleSheet } from "react-native";

import { AccountSection } from "@/components/AccountSection";
import { Row, Section } from "@/components/ui";
import { authClient } from "@/auth/client";
import { getLocalePref, setLocalePref } from "@/db/settings";
import { LOCALE_NAMES, LOCALES, useTranslation, type LocalePref } from "@/i18n";
import {
  getNotificationStatus,
  requestNotificationPermission,
  type NotificationStatus,
} from "@/notifications/setup";
import { spacing, useTheme } from "@/theme";

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const [pref, setPref] = useState<LocalePref>("auto");
  const [notifications, setNotifications] = useState<NotificationStatus>("undetermined");

  useEffect(() => {
    void getLocalePref(db).then(setPref);
    void getNotificationStatus().then(setNotifications);
  }, [db]);

  const choose = useCallback(
    async (next: LocalePref) => {
      const previous = pref;
      setPref(next);
      try {
        await setLocalePref(db, next);
      } catch {
        setPref(previous);
      }
    },
    [db, pref],
  );

  const askNotifications = useCallback(async () => {
    setNotifications(await requestNotificationPermission());
  }, []);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      <Section title={t("settings.language")}>
        <Row
          label={t("settings.languageAuto")}
          selected={pref === "auto"}
          onPress={() => choose("auto")}
        />
        {LOCALES.map((locale) => (
          <Row
            key={locale}
            label={LOCALE_NAMES[locale]}
            selected={pref === locale}
            onPress={() => void choose(locale)}
          />
        ))}
      </Section>
      <Section title={t("settings.notifications")}>
        {notifications === "granted" ? (
          <Row label={t("settings.notificationsGranted")} selected onPress={() => {}} disabled />
        ) : notifications === "denied" ? (
          <Row
            label={t("settings.notificationsOpenSettings")}
            onPress={() => void Linking.openSettings()}
          />
        ) : (
          <Row label={t("settings.notificationsAsk")} onPress={() => void askNotifications()} />
        )}
      </Section>
      <Section title={t("ramadhan.tab")}>
        <Row label={t("ramadhan.settingsRow")} onPress={() => router.push("/ramadhan")} />
      </Section>
      {authClient ? <AccountSection client={authClient} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.lg },
});
