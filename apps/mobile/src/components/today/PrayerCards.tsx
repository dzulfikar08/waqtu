import { formatLocalTime } from "@waqtu/core";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { CITIES } from "@/prayer/cities";
import {
  getLocationPermission,
  saveCity,
  saveCurrentLocation,
  type LocationPermission,
} from "@/prayer/location";
import { countdownParts, type PrayerSlot } from "@/prayer/schedule";
import { useTranslation } from "@/i18n";
import { radius, spacing, useTheme } from "@/theme";

import { Row } from "../ui";

export function NextPrayerCard({
  slot,
  now,
  timeZone,
}: {
  slot: PrayerSlot;
  now: Date;
  timeZone: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { hours, minutes } = countdownParts(slot.at.getTime() - now.getTime());
  const time =
    hours > 0
      ? t("today.countdownHm", { h: hours, m: minutes })
      : t("today.countdownM", { m: minutes });
  return (
    <View style={[styles.hero, { backgroundColor: theme.accent }]}>
      <Text style={{ color: theme.accentText, opacity: 0.85, fontSize: 14 }}>
        {t("today.next")}
      </Text>
      <Text style={{ color: theme.accentText, fontSize: 32, fontWeight: "700" }}>
        {t(`prayers.${slot.prayer}`)} · {formatLocalTime(slot.at, timeZone)}
      </Text>
      <Text style={{ color: theme.accentText, fontSize: 18 }}>{t("today.in", { time })}</Text>
    </View>
  );
}

const LIST = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"] as const;

export function PrayerTimesList({
  times,
  highlight,
}: {
  times: Readonly<Record<string, string | null>>;
  highlight: string | null;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View>
      {LIST.map((name) => (
        <View key={name} style={[styles.timeRow, { borderColor: theme.border }]}>
          <Text
            style={{
              color: name === highlight ? theme.accent : theme.text,
              fontSize: 16,
              fontWeight: name === highlight ? "700" : "400",
            }}
          >
            {t(`prayers.${name}`)}
          </Text>
          <Text
            style={{
              color: name === highlight ? theme.accent : theme.text,
              fontSize: 16,
              fontWeight: name === highlight ? "700" : "400",
            }}
          >
            {times[name] ?? "–"}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Shown until a location exists: the phone's position (with permission) or a city from the list. */
export function LocationPrompt() {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const theme = useTheme();
  const [permission, setPermission] = useState<LocationPermission>("undetermined");
  const [failed, setFailed] = useState(false);
  const [picking, setPicking] = useState(false);

  const useGps = async () => {
    setFailed(false);
    const result = await saveCurrentLocation(db, { ask: true });
    if (result === "ok") return;
    setPermission(await getLocationPermission());
    setFailed(true);
  };

  return (
    <View
      style={[
        styles.card,
        styles.prompt,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <Text style={{ color: theme.text, fontSize: 18, fontWeight: "700" }}>
        {t("today.locationTitle")}
      </Text>
      <Text style={{ color: theme.muted, fontSize: 14 }}>{t("today.locationBody")}</Text>
      {failed ? (
        <Text style={{ color: theme.muted, fontSize: 14 }}>{t("today.locationFailed")}</Text>
      ) : null}
      <View style={styles.buttons}>
        <Button label={t("today.useGps")} primary onPress={() => void useGps()} />
        <Button label={t("today.pickCity")} onPress={() => setPicking((p) => !p)} />
        {permission === "denied" ? (
          <Button
            label={t("today.openSystemSettings")}
            onPress={() => void Linking.openSettings()}
          />
        ) : null}
      </View>
      {picking ? (
        <View style={[styles.card, { borderColor: theme.border }]}>
          {CITIES.map((city) => (
            <Row key={city.id} label={city.name} onPress={() => void saveCity(db, city)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Button({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: primary ? theme.accent : "transparent",
          borderColor: primary ? theme.accent : theme.border,
        },
      ]}
    >
      <Text style={{ color: primary ? theme.accentText : theme.text, fontWeight: "600" }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  timeRow: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  prompt: { padding: spacing.md, gap: spacing.sm },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  button: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
