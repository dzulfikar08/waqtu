import { MaterialCommunityIcons } from "@expo/vector-icons";
import { formatLocalTime } from "@waqtu/core";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState, type ComponentProps } from "react";
import { Animated, Easing, Linking, StyleSheet, Text, View } from "react-native";

import { useNow } from "@/hooks/useMutabaah";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTranslation } from "@/i18n";
import { CITIES } from "@/prayer/cities";
import {
  getLocationPermission,
  saveCity,
  saveCurrentLocation,
  type LocationPermission,
} from "@/prayer/location";
import { periodProgress, type DayPeriod, type PeriodSpan } from "@/prayer/period";
import { countdownParts, type PrayerSlot } from "@/prayer/schedule";
import {
  onSky,
  prayerTone,
  radius,
  skyGradient,
  skyTone,
  spacing,
  tabular,
  typography,
  useTheme,
} from "@/theme";

import { HeroGlow } from "../HeroGlow";
import { Card, Divider, PressableScale, ProgressTrack, Row } from "../ui";

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

/** The body in the sky of each part of the day: the rising sun, the high sun, the setting sun, the moon. */
const SKY_BODY: Record<DayPeriod, GlyphName> = {
  fajr: "weather-sunset-up",
  sunrise: "weather-sunny",
  dhuhr: "white-balance-sunny",
  asr: "weather-sunny",
  maghrib: "weather-sunset-down",
  isha: "moon-waning-crescent",
};

/** Star positions (percent of the card) for the night and dawn skies. */
const STARS: readonly { top: `${number}%`; left: `${number}%`; size: number }[] = [
  { top: "12%", left: "48%", size: 3 },
  { top: "22%", left: "62%", size: 2 },
  { top: "8%", left: "70%", size: 2 },
  { top: "34%", left: "54%", size: 2 },
  { top: "18%", left: "38%", size: 2 },
  { top: "44%", left: "66%", size: 3 },
];

/**
 * Decoration of a sky card, drawn behind its content: a soft glow and the sun or moon of the part of the day in the top
 * right corner, and twinkling stars at night and dawn. Hidden from screen readers.
 */
export function SkyArt({ period }: { period: DayPeriod }) {
  const night = period === "isha" || period === "fajr";
  const reduced = useReducedMotion();
  const [twinkle] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!night || reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(twinkle, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [night, reduced, twinkle]);
  return (
    <HeroGlow breathe glow={night ? "rgba(214,222,255,0.40)" : "rgba(255,238,196,0.62)"}>
      <MaterialCommunityIcons
        name={SKY_BODY[period]}
        size={84}
        color="rgba(255,255,255,0.92)"
        style={styles.body}
      />
      {night
        ? STARS.map((star, index) => (
            <Animated.View
              key={`${star.top}-${star.left}`}
              style={[
                styles.star,
                {
                  top: star.top,
                  left: star.left,
                  width: star.size,
                  height: star.size,
                  borderRadius: star.size / 2,
                  opacity: twinkle.interpolate({
                    inputRange: [0, 1],
                    outputRange: index % 2 === 0 ? [0.9, 0.35] : [0.35, 0.9],
                  }),
                },
              ]}
            />
          ))
        : null}
    </HeroGlow>
  );
}

/** Hours, minutes and seconds until `ms` has passed, as "1:05:09". */
function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * The next prayer on the sky of the current part of the day (dawn violet, morning blue, bright noon, amber afternoon,
 * sunset rose, indigo night; dimmed in dark mode): its name, a live seconds countdown, its clock time, and how far the
 * current part of the day has run.
 */
export function NextPrayerHero({
  slot,
  span,
  timeZone,
}: {
  slot: PrayerSlot;
  span: PeriodSpan | null;
  timeZone: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const now = useNow(1000);
  const left = slot.at.getTime() - now.getTime();
  const { hours, minutes } = countdownParts(left);
  const time =
    hours > 0
      ? t("today.countdownHm", { h: hours, m: minutes })
      : t("today.countdownM", { m: minutes });
  const period = span?.period ?? slot.prayer;
  return (
    <View
      style={[
        styles.sky,
        {
          experimental_backgroundImage: skyGradient(period, theme.dark),
          boxShadow: theme.dark
            ? "0 10px 24px -12px rgba(0,0,0,0.6)"
            : `0 14px 28px -14px ${skyTone(period, false)}`,
        },
      ]}
    >
      <SkyArt period={period} />
      <View style={styles.skyHead}>
        <Text style={[typography.subhead, { color: onSky.muted, fontWeight: "600" }]}>
          {t("today.next")}
        </Text>
        <Text style={[styles.skyName, { color: onSky.text }]}>{t(`prayers.${slot.prayer}`)}</Text>
      </View>
      <Text
        accessibilityLabel={t("today.in", { time })}
        accessibilityLiveRegion="polite"
        style={[styles.skyCountdown, tabular, { color: onSky.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {clock(left)}
      </Text>
      <View style={styles.skyMeta}>
        <View style={[styles.glassPill, { backgroundColor: onSky.glassStrong }]}>
          <MaterialCommunityIcons name="clock-outline" size={15} color={onSky.text} />
          <Text style={[typography.callout, tabular, { color: onSky.text, fontWeight: "700" }]}>
            {formatLocalTime(slot.at, timeZone)}
          </Text>
        </View>
        <Text style={[typography.subhead, styles.grow, { color: onSky.muted }]} numberOfLines={1}>
          {t("today.in", { time })}
        </Text>
      </View>
      {span ? (
        <View style={styles.skyProgress}>
          <ProgressTrack
            value={periodProgress(span, now)}
            fill="rgba(255,255,255,0.95)"
            track={onSky.glass}
            height={6}
          />
          <View style={styles.skyEnds}>
            <Text style={[typography.caption, tabular, { color: onSky.muted }]}>
              {t(`prayers.${span.period}`)} {formatLocalTime(span.start, timeZone)}
            </Text>
            <Text style={[typography.caption, tabular, { color: onSky.muted }]}>
              {t(`prayers.${span.next}`)} {formatLocalTime(span.end, timeZone)}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const LIST = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"] as const;

/**
 * Today's times, one row per prayer with its glyph in the prayer's own colour and the time right-aligned in even
 * digits. Prayers already past are dimmed; the next one sits on a wash of its colour with a "Next prayer" caption.
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
        const own = prayerTone(name, theme.dark);
        const tone = isNext ? own : passed ? theme.faint : theme.text;
        return (
          <View key={name}>
            {index > 0 ? <Divider inset={spacing.md + 32 + 12} /> : null}
            <View style={[styles.timeRow, isNext ? { backgroundColor: `${own}1F` } : null]}>
              {isNext ? <View style={[styles.nextBar, { backgroundColor: own }]} /> : null}
              <View
                style={[
                  styles.timeGlyph,
                  { backgroundColor: passed ? "transparent" : `${own}${theme.dark ? "29" : "1A"}` },
                ]}
              >
                <PrayerGlyph prayer={name} size={19} color={passed ? theme.faint : own} />
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
                  <Text style={[typography.caption, { color: own, fontWeight: "600" }]}>
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

/**
 * Shown until a location exists, on the sky of the phone's hour: a pin in rings, why the location is needed, and the
 * two ways to set it (the phone's position, with permission, or a city from the list).
 */
export function LocationPrompt({ period }: { period: DayPeriod }) {
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
        styles.sky,
        {
          experimental_backgroundImage: skyGradient(period, theme.dark),
          boxShadow: theme.dark
            ? "0 10px 24px -12px rgba(0,0,0,0.6)"
            : `0 14px 28px -14px ${skyTone(period, false)}`,
        },
      ]}
    >
      <SkyArt period={period} />
      <View style={[styles.pin, { backgroundColor: onSky.glassStrong, borderColor: onSky.line }]}>
        <View style={[styles.pinInner, { backgroundColor: onSky.text }]}>
          <MaterialCommunityIcons
            name="map-marker-radius"
            size={28}
            color={skyTone(period, false)}
          />
        </View>
      </View>
      <Text style={[typography.title, { color: onSky.text }]}>{t("today.locationTitle")}</Text>
      <Text style={[typography.subhead, { color: onSky.muted, lineHeight: 20 }]}>
        {t("today.locationBody")}
      </Text>
      {failed ? (
        <View style={[styles.glassNote, { backgroundColor: onSky.glassStrong }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={16} color={onSky.text} />
          <Text style={[typography.subhead, styles.grow, { color: onSky.text }]}>
            {t("today.locationFailed")}
          </Text>
        </View>
      ) : null}
      <View style={styles.buttons}>
        <SkyButton
          label={t("today.useGps")}
          icon="crosshairs-gps"
          primary
          tone={skyTone(period, false)}
          onPress={() => void useGps()}
        />
        <SkyButton
          label={t("today.pickCity")}
          icon="city-variant-outline"
          tone={skyTone(period, false)}
          onPress={() => setPicking((p) => !p)}
        />
        {permission === "denied" ? (
          <SkyButton
            label={t("today.openSystemSettings")}
            icon="cog-outline"
            tone={skyTone(period, false)}
            onPress={() => void Linking.openSettings()}
          />
        ) : null}
      </View>
      {picking ? (
        <View style={[styles.cityList, { backgroundColor: theme.surface }]}>
          {CITIES.map((city) => (
            <Row
              key={city.id}
              icon="location-outline"
              hue="prayer"
              label={city.name}
              onPress={() => void saveCity(db, city)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** A button on a sky card: solid white (primary) or frosted glass. */
function SkyButton({
  label,
  icon,
  onPress,
  primary,
  tone,
}: {
  label: string;
  icon: GlyphName;
  onPress: () => void;
  primary?: boolean;
  /** The sky's colour, for the primary button's text. */
  tone: string;
}) {
  const color = primary ? tone : onSky.text;
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.button,
        primary
          ? { backgroundColor: onSky.text, borderColor: onSky.text }
          : { backgroundColor: onSky.glass, borderColor: onSky.line },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={18} color={color} />
      <Text style={[typography.callout, { color, fontWeight: "700" }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  sky: {
    borderRadius: radius.lg + 4,
    padding: spacing.md + 4,
    gap: spacing.sm,
    overflow: "hidden",
  },
  body: { position: "absolute", top: 4, right: 14 },
  star: { position: "absolute", backgroundColor: "#FFFFFF" },
  skyHead: { gap: 0, paddingRight: 96 },
  skyName: { fontSize: 34, fontWeight: "800", letterSpacing: -0.6 },
  skyCountdown: { fontSize: 52, fontWeight: "800", letterSpacing: -1.2, marginTop: spacing.xs },
  skyMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 },
  glassPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.md - 4,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  skyProgress: { gap: 6, marginTop: spacing.sm },
  skyEnds: { flexDirection: "row", justifyContent: "space-between" },
  grow: { flex: 1 },
  timeRow: {
    minHeight: 54,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  nextBar: { position: "absolute", left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2 },
  timeGlyph: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pin: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  pinInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  glassNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
  },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  button: {
    minHeight: 46,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  cityList: {
    marginTop: spacing.sm,
    borderRadius: radius.md + 4,
    overflow: "hidden",
  },
});
