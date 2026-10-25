import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Linking } from "react-native";

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
      <Section title={t("settings.language")} icon="language">
        <Row
          label={t("settings.languageAuto")}
          icon="phone-portrait-outline"
          selected={pref === "auto"}
          onPress={() => choose("auto")}
        />
        {LOCALES.map((locale) => (
          <Row
            key={locale}
            label={LOCALE_NAMES[locale]}
            icon="globe-outline"
            selected={pref === locale}
            onPress={() => void choose(locale)}
          />
        ))}
      </Section>
      <PrayerSettingsSection />
      <StreakSettingsSection />
      <Section title={t("settings.notifications")} icon="notifications">
        {notifications === "granted" ? (
          <Row
            label={t("settings.notificationsGranted")}
            icon="notifications-outline"
            selected
            onPress={() => {}}
            disabled
          />
        ) : notifications === "denied" ? (
          <Row
            label={t("settings.notificationsOpenSettings")}
            icon="notifications-off-outline"
            chevron
            onPress={() => void Linking.openSettings()}
          />
        ) : (
          <Row
            label={t("settings.notificationsAsk")}
            icon="notifications-outline"
            onPress={() => void askNotifications()}
          />
        )}
        {exactAlarm ? null : (
          <Row
            label={t("settings.exactAlarm")}
            icon="alarm-outline"
            chevron
            onPress={openExactAlarmSettings}
          />
        )}
      </Section>
      <Section title={t("ramadhan.tab")} icon="moon">
        <Row
          label={t("ramadhan.settingsRow")}
          icon="moon-outline"
          chevron
          onPress={() => router.push("/ramadhan")}
        />
      </Section>
      <Section title={t("hafalan.title")} icon="book">
        <Row
          label={t("hafalan.settingsRow")}
          icon="book-outline"
          chevron
          onPress={() => router.push("/hafalan")}
        />
      </Section>
      {authClient ? <PremiumSection /> : null}
      {authClient ? <AccountSection client={authClient} /> : null}
      <Section title={t("about.licences")} icon="information-circle">
        <Row
          label={t("about.row")}
          icon="document-text-outline"
          chevron
          onPress={() => router.push("/about")}
        />
      </Section>
    </Screen>
  );
}
