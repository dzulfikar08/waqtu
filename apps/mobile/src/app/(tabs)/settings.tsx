import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Linking } from "react-native";

import { AdminSection } from "@/admin/AdminSection";
import { AccountSection } from "@/components/AccountSection";
import { PrayerSettingsSection } from "@/components/PrayerSettingsSection";
import { StreakSettingsSection } from "@/components/StreakSettingsSection";
import { PremiumSection } from "@/premium/PremiumSection";
import { Row, Screen, Section } from "@/components/ui";
import { authClient } from "@/auth/client";
import { getLocalePref, setLocalePref } from "@/db/settings";
import { LOCALE_NAMES, LOCALES, useTranslation, type LocalePref } from "@/i18n";
import {
  getNotificationStatus,
  requestNotificationPermission,
  type NotificationStatus,
} from "@/notifications/setup";
import { useExactAlarmAllowed } from "@/notifications/useExactAlarm";
import { openExactAlarmSettings } from "../../../modules/exact-alarm";

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { t } = useTranslation();
  const [pref, setPref] = useState<LocalePref>("auto");
  const exactAlarm = useExactAlarmAllowed();
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
    <Screen title={t("tabs.settings")}>
      <Section title={t("settings.language")} icon="language" hue="week">
        <Row
          label={t("settings.languageAuto")}
          icon="phone-portrait-outline"
          hue="week"
          selected={pref === "auto"}
          onPress={() => choose("auto")}
        />
        {LOCALES.map((locale) => (
          <Row
            key={locale}
            label={LOCALE_NAMES[locale]}
            icon="globe-outline"
            hue="week"
            selected={pref === locale}
            onPress={() => void choose(locale)}
          />
        ))}
      </Section>
      <PrayerSettingsSection />
      <StreakSettingsSection />
      <Section title={t("settings.notifications")} icon="notifications" hue="halaqah">
        {notifications === "granted" ? (
          <Row
            label={t("settings.notificationsGranted")}
            icon="notifications-outline"
            hue="halaqah"
            selected
            onPress={() => {}}
            disabled
          />
        ) : notifications === "denied" ? (
          <Row
            label={t("settings.notificationsOpenSettings")}
            icon="notifications-off-outline"
            hue="halaqah"
            chevron
            onPress={() => void Linking.openSettings()}
          />
        ) : (
          <Row
            label={t("settings.notificationsAsk")}
            icon="notifications-outline"
            hue="halaqah"
            onPress={() => void askNotifications()}
          />
        )}
        {exactAlarm ? null : (
          <Row
            label={t("settings.exactAlarm")}
            icon="alarm-outline"
            hue="halaqah"
            chevron
            onPress={openExactAlarmSettings}
          />
        )}
      </Section>
      <Section title={t("ramadhan.tab")} icon="moon" hue="ramadhan">
        <Row
          label={t("ramadhan.settingsRow")}
          icon="moon-outline"
          hue="ramadhan"
          chevron
          onPress={() => router.push("/ramadhan")}
        />
      </Section>
      <Section title={t("hafalan.title")} icon="book" hue="hafalan">
        <Row
          label={t("hafalan.settingsRow")}
          icon="book-outline"
          hue="hafalan"
          chevron
          onPress={() => router.push("/hafalan")}
        />
      </Section>
      {authClient ? <PremiumSection /> : null}
      {authClient ? <AccountSection client={authClient} /> : null}
      {authClient ? <AdminSection client={authClient} /> : null}
      <Section title={t("about.licences")} icon="information-circle" hue="neutral">
        <Row
          label={t("about.row")}
          icon="document-text-outline"
          hue="neutral"
          chevron
          onPress={() => router.push("/about")}
        />
      </Section>
    </Screen>
  );
}
