import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { Text } from "react-native";

import { setSyncedSetting } from "@/db/settings";
import { usePrayerSettings } from "@/hooks/usePrayerSettings";
import { useTranslation } from "@/i18n";
import { CITIES } from "@/prayer/cities";
import {
  ASR_MADHABS,
  MAX_HIJRI_OFFSET,
  MAX_OFFSET_MINUTES,
  METHOD_IDS,
  OFFSET_PRAYERS,
  PRAYER_KEYS,
} from "@/prayer/config";
import { saveCity, saveCurrentLocation } from "@/prayer/location";
import { spacing, useTheme } from "@/theme";

import { Row, Section, StepperRow } from "./ui";

export function PrayerSettingsSection() {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const theme = useTheme();
  const settings = usePrayerSettings();
  const [picking, setPicking] = useState(false);
  const [gpsFailed, setGpsFailed] = useState(false);

  if (!settings) return null;
  const place =
    settings.location?.name ||
    (settings.location ? t("prayerSettings.locationGps") : t("prayerSettings.locationNone"));

  return (
    <>
      <Section title={t("prayerSettings.location")}>
        <Row label={place} onPress={() => {}} selected={settings.location !== null} disabled />
        <Row
          label={t("today.useGps")}
          onPress={() => {
            setGpsFailed(false);
            void saveCurrentLocation(db, { ask: true }).then((result) =>
              setGpsFailed(result !== "ok"),
            );
          }}
        />
        <Row label={t("today.pickCity")} onPress={() => setPicking((p) => !p)} />
        {picking
          ? CITIES.map((city) => (
              <Row
                key={city.id}
                label={city.name}
                selected={settings.location?.name === city.name}
                onPress={() => {
                  void saveCity(db, city);
                  setPicking(false);
                }}
              />
            ))
          : null}
        {gpsFailed ? (
          <Text style={{ color: theme.muted, padding: spacing.md }}>
            {t("today.locationFailed")}
          </Text>
        ) : null}
      </Section>

      <Section title={t("prayerSettings.method")}>
        {METHOD_IDS.map((id) => (
          <Row
            key={id}
            label={t(`prayerSettings.methods.${id}`)}
            selected={settings.method === id}
            onPress={() => void setSyncedSetting(db, PRAYER_KEYS.method, id)}
          />
        ))}
      </Section>

      <Section title={t("prayerSettings.asr")}>
        {ASR_MADHABS.map((id) => (
          <Row
            key={id}
            label={t(`prayerSettings.asrMadhab.${id}`)}
            selected={settings.asr === id}
            onPress={() => void setSyncedSetting(db, PRAYER_KEYS.asr, id)}
          />
        ))}
      </Section>

      <Section title={t("prayerSettings.offsets")}>
        {OFFSET_PRAYERS.map((prayer) => (
          <StepperRow
            key={prayer}
            label={t(`prayers.${prayer}`)}
            value={settings.offsets[prayer] ?? 0}
            min={-MAX_OFFSET_MINUTES}
            max={MAX_OFFSET_MINUTES}
            onChange={(next) => void setSyncedSetting(db, PRAYER_KEYS.offset(prayer), String(next))}
          />
        ))}
        <StepperRow
          label={t("prayerSettings.hijriOffset")}
          value={settings.hijriOffset}
          min={-MAX_HIJRI_OFFSET}
          max={MAX_HIJRI_OFFSET}
          onChange={(next) => void setSyncedSetting(db, PRAYER_KEYS.hijriOffset, String(next))}
        />
      </Section>
    </>
  );
}
