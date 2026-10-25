import { MaterialCommunityIcons } from "@expo/vector-icons";
import { formatLocalTime } from "@waqtu/core";
import { useSQLiteContext } from "expo-sqlite";
import { useState, type ComponentProps } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

import { CITIES } from "@/prayer/cities";
import {
  getLocationPermission,
  saveCity,
  saveCurrentLocation,
  type LocationPermission,
} from "@/prayer/location";
import { countdownParts, type PrayerSlot } from "@/prayer/schedule";
import { useTranslation } from "@/i18n";
import { radius, spacing, tabular, typography, useTheme } from "@/theme";

import { Card, Divider, IconChip, PressableScale, Row } from "../ui";

type GlyphName = ComponentProps<typeof MaterialCommunityIcons>["name"];

/** The SF Symbols of `PrayerName.symbolName` (sun.and.horizon, sun.max, sun.min, sunset, moon.stars) in Material glyphs. */
export const PRAYER_GLYPHS: Record<string, GlyphName> = {
  fajr: "weather-sunset-up",
  sunrise: "weather-sunset",
  dhuhr: "white-balance-sunny",
  asr: "weather-sunny",
  maghrib: "weather-sunset-down",
  isha: "weather-night",
};

export function PrayerGlyph({
  prayer,
  size,
  color,
}: {
  prayer: string;
  size: number;
  color: string;
}) {
  return (
    <MaterialCommunityIcons
      name={PRAYER_GLYPHS[prayer] ?? "clock-outline"}
      size={size}
      color={color}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

/**
 * The next prayer, as the Mac popover's header and the iOS companion's card: the prayer's glyph and name, the live
 * countdown in large digits (gold on dark, teal on light) and the prayer's clock time.
 */
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
  const at = formatLocalTime(slot.at, timeZone);
  return (
    <Card style={styles.hero}>
      <View style={styles.heroTop}>
        <View
          style={[
            styles.heroGlyph,
            { backgroundColor: theme.dark ? theme.goldSoft : theme.accentSoft },
          ]}
        >
          <PrayerGlyph prayer={slot.prayer} size={26} color={theme.countdown} />
        </View>
        <View style={styles.grow}>
          <Text style={[typography.footnote, { color: theme.muted, fontWeight: "600" }]}>
            {t("today.next")}
          </Text>
          <Text style={[typography.title, { color: theme.text }]}>
            {t(`prayers.${slot.prayer}`)}
          </Text>
        </View>
        <View style={[styles.timeBadge, { backgroundColor: theme.surfaceAlt }]}>
          <Text style={[typography.headline, tabular, { color: theme.text }]}>{at}</Text>
        </View>
      </View>
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.countdown, tabular, { color: theme.countdown }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {t("today.in", { time })}
      </Text>
    </Card>
  );
}

const LIST = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"] as const;

/**
 * Today's times, one row per prayer with its glyph and the time right-aligned in even digits. Prayers already past are
 * dimmed; the next one sits on a soft accent wash with a "Next prayer" caption, as in the iOS companion.
 */
export function PrayerTimesList({
  times,
  highlight,
  allPassed,
}: {
  times: Readonly<Record<string, string | null>>;
  highlight: string | null;
  /** True after Isha, when the next prayer is tomorrow's Fajr. */
  allPassed: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const nextIndex = highlight ? LIST.indexOf(highlight as (typeof LIST)[number]) : -1;
  return (
    <Card padded={false}>
      {LIST.map((name, index) => {
        const isNext = index === nextIndex;
        const passed = allPassed || (nextIndex >= 0 && index < nextIndex);
        const tone = isNext ? theme.accent : passed ? theme.faint : theme.text;
        return (
          <View key={name}>
            {index > 0 ? <Divider inset={spacing.md + 28 + 12} /> : null}
            <View style={[styles.timeRow, isNext ? { backgroundColor: theme.accentSoft } : null]}>
              <View style={styles.timeGlyph}>
                <PrayerGlyph
                  prayer={name}
                  size={22}
                  color={isNext ? theme.accent : passed ? theme.faint : theme.muted}
                />
              </View>
              <View style={styles.grow}>
                <Text
                  style={[
                    typography.body,
                    { color: tone, fontWeight: isNext ? "700" : passed ? "400" : "500" },
                  ]}
                >
                  {t(`prayers.${name}`)}
                </Text>
                {isNext ? (
                  <Text style={[typography.caption, { color: theme.accent, fontWeight: "600" }]}>
                    {t("today.next")}
                  </Text>
                ) : null}
              </View>
              <Text
                style={[
                  typography.body,
                  tabular,
                  { color: tone, fontWeight: isNext ? "700" : passed ? "400" : "600" },
                ]}
              >
                {times[name] ?? "–"}
              </Text>
            </View>
          </View>
        );
      })}
    </Card>
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
    <Card style={styles.prompt}>
      <View style={styles.heroTop}>
        <IconChip icon="location" size={40} />
        <Text style={[typography.headline, styles.grow, { color: theme.text }]}>
          {t("today.locationTitle")}
        </Text>
      </View>
      <Text style={[typography.subhead, { color: theme.muted, lineHeight: 20 }]}>
        {t("today.locationBody")}
      </Text>
      {failed ? (
        <Text style={[typography.subhead, { color: theme.danger }]}>
          {t("today.locationFailed")}
        </Text>
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
        <View style={[styles.cityList, { borderColor: theme.separator }]}>
          {CITIES.map((city) => (
            <Row key={city.id} label={city.name} onPress={() => void saveCity(db, city)} />
          ))}
        </View>
      ) : null}
    </Card>
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
    <PressableScale
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
      <Text
        style={[
          typography.callout,
          { color: primary ? theme.accentText : theme.text, fontWeight: "600" },
        ]}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  hero: {},
  heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.md - 4 },
  heroGlyph: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  timeBadge: {
    paddingHorizontal: spacing.md - 4,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  countdown: { fontSize: 40, fontWeight: "800", letterSpacing: -0.8, marginTop: spacing.xs },
  grow: { flex: 1 },
  timeRow: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  timeGlyph: { width: 28, alignItems: "center" },
  prompt: {},
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  button: {
    minHeight: 44,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  cityList: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
});
