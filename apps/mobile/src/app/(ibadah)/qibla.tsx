import { Ionicons } from "@expo/vector-icons";
import { distanceToKaabaKm, isAligned, qiblaBearing, turnTo } from "@waqtu/core";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Easing,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, IconChip } from "@/components/ui";
import { useMutabaah } from "@/hooks/useMutabaah";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTranslation } from "@/i18n";
import {
  headingOf,
  needsCalibration,
  unwrapAngle,
  type Heading,
  type HeadingReading,
} from "@/ibadah/compass";
import { Button } from "@/ramadhan/components/fields";
import { hueColors, radius, spacing, tabular, typography, useTheme } from "@/theme";

type CompassState = "checking" | "ask" | "denied" | "unavailable" | "live";

/** Degrees either side of the qibla that count as facing it. */
const TOLERANCE = 3;
const TICKS = Array.from({ length: 72 }, (_, i) => i * 5);
const CARDINALS = [
  { angle: 0, key: "north" },
  { angle: 90, key: "east" },
  { angle: 180, key: "south" },
  { angle: 270, key: "west" },
] as const;

/**
 * Qibla: the bearing from the saved prayer location (works offline, no GPS needed) and a live compass. The compass reads
 * `watchHeadingAsync`, which both platforms only serve with location permission; nothing from it is stored.
 */
export default function QiblaScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const model = useMutabaah();
  const location = model?.settings.location ?? null;
  const qibla = hueColors(theme, "qibla");

  if (!model) return null;
  if (!location) {
    return (
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
      >
        <Card hue="qibla">
          <View style={styles.row}>
            <IconChip icon="location-outline" color={qibla.base} background={qibla.soft} />
            <Text style={[typography.body, styles.grow, { color: theme.text }]}>
              {t("ibadah.qibla.noLocation")}
            </Text>
          </View>
          <Button
            label={t("ibadah.qibla.openSettings")}
            icon="settings-outline"
            block
            onPress={() => router.push("/settings")}
          />
        </Card>
      </ScrollView>
    );
  }

  const bearing = qiblaBearing(location.latitude, location.longitude);
  const km = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 }).format(
    distanceToKaabaKm(location.latitude, location.longitude),
  );
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
    >
      <Card hue="qibla">
        <Text style={[typography.overline, { color: theme.muted }]}>
          {t("ibadah.qibla.bearing")}
        </Text>
        <View style={styles.bearingRow}>
          <Text
            style={[styles.bearing, tabular, { color: qibla.base }]}
            accessibilityLabel={`${t("ibadah.qibla.bearing")} ${Math.round(bearing)}°`}
          >
            {Math.round(bearing)}°
          </Text>
          <Text style={[typography.subhead, styles.grow, { color: theme.muted }]}>
            {t("ibadah.qibla.fromNorth")}
          </Text>
        </View>
        <Text style={[typography.footnote, { color: theme.muted }]}>
          {location.name
            ? t("ibadah.qibla.from", { place: location.name })
            : t("ibadah.qibla.fromHere")}
          {" · "}
          {t("ibadah.qibla.distance", { km })}
        </Text>
      </Card>
      <LiveCompass bearing={bearing} />
      <Text style={[typography.footnote, styles.tip, { color: theme.muted }]}>
        {t("ibadah.qibla.tip")}
      </Text>
    </ScrollView>
  );
}

function LiveCompass({ bearing }: { bearing: number }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const qibla = hueColors(theme, "qibla");
  const [state, setState] = useState<CompassState>("checking");
  const [heading, setHeading] = useState<Heading | null>(null);
  const [accuracy, setAccuracy] = useState(3);

  const check = useCallback(async () => {
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status === "granted") setState("live");
      else if (permission.status === "undetermined" || permission.canAskAgain) setState("ask");
      else setState("denied");
    } catch {
      setState("unavailable");
    }
  }, []);

  useEffect(() => {
    void check();
    // Back from the system settings with the permission granted: start the compass.
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void check();
    });
    return () => sub.remove();
  }, [check]);

  useEffect(() => {
    if (state !== "live") return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    void Location.watchHeadingAsync(
      (reading: HeadingReading) => {
        const next = headingOf(reading);
        if (!next) return;
        setHeading(next);
        setAccuracy(reading.accuracy);
      },
      () => {
        if (!cancelled) setState("unavailable");
      },
    )
      .then((sub) => {
        if (cancelled) sub.remove();
        else subscription = sub;
      })
      .catch(() => {
        if (!cancelled) setState("unavailable");
      });
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [state]);

  const ask = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setState(status === "granted" ? "live" : "denied");
    } catch {
      setState("unavailable");
    }
  };

  if (state === "checking") return null;
  if (state !== "live") {
    const body =
      state === "ask"
        ? t("ibadah.qibla.permissionBody")
        : state === "denied"
          ? t("ibadah.qibla.denied")
          : t("ibadah.qibla.unavailable");
    return (
      <Card hue="qibla">
        {state === "ask" ? (
          <Text style={[typography.headline, { color: theme.text }]}>
            {t("ibadah.qibla.permissionTitle")}
          </Text>
        ) : null}
        <Text style={[typography.subhead, { color: theme.muted, lineHeight: 20 }]}>{body}</Text>
        {state === "ask" ? (
          <Button
            label={t("ibadah.qibla.allow")}
            icon="compass-outline"
            block
            onPress={() => void ask()}
          />
        ) : state === "denied" ? (
          <Button
            label={t("ibadah.qibla.openSystemSettings")}
            icon="open-outline"
            tone="plain"
            block
            onPress={() => void Linking.openSettings()}
          />
        ) : null}
      </Card>
    );
  }

  if (!heading) {
    return (
      <Card hue="qibla">
        <Text style={[typography.subhead, { color: theme.muted }]}>
          {t("ibadah.qibla.starting")}
        </Text>
      </Card>
    );
  }

  const aligned = isAligned(heading.degrees, bearing, TOLERANCE);
  const turn = Math.round(turnTo(heading.degrees, bearing));
  return (
    <View style={styles.compass}>
      <Dial heading={heading.degrees} bearing={bearing} aligned={aligned} />
      <View
        style={[
          styles.status,
          {
            backgroundColor: aligned ? theme.accent : qibla.soft,
            borderColor: aligned ? theme.accent : qibla.base,
          },
        ]}
      >
        <Ionicons
          name={aligned ? "checkmark-circle" : turn > 0 ? "arrow-redo" : "arrow-undo"}
          size={22}
          color={aligned ? theme.accentText : qibla.base}
        />
        <Text
          accessibilityLiveRegion="polite"
          style={[
            typography.headline,
            tabular,
            { color: aligned ? theme.accentText : theme.text },
          ]}
        >
          {aligned
            ? t("ibadah.qibla.aligned")
            : turn > 0
              ? t("ibadah.qibla.turnRight", { deg: turn })
              : t("ibadah.qibla.turnLeft", { deg: -turn })}
        </Text>
      </View>
      <Text style={[typography.footnote, tabular, { color: theme.muted, textAlign: "center" }]}>
        {`${Math.round(heading.degrees)}° · `}
        {heading.trueNorth ? t("ibadah.qibla.trueNorth") : t("ibadah.qibla.magneticNorth")}
      </Text>
      {needsCalibration(accuracy) ? (
        <Card>
          <View style={styles.row}>
            <IconChip icon="infinite" color={theme.warning} background={theme.warningSoft} />
            <View style={styles.grow}>
              <Text style={[typography.headline, { color: theme.text }]}>
                {t("ibadah.qibla.calibrateTitle")}
              </Text>
              <Text style={[typography.subhead, { color: theme.muted, lineHeight: 20 }]}>
                {t("ibadah.qibla.calibrateBody")}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}
    </View>
  );
}

/**
 * The compass rose turns against the phone's heading so north stays north; the qibla needle sits on the rose at the
 * bearing, and the fixed arrow on top is where the phone points. Facing the qibla turns the arrow, the rim and the
 * needle green and buzzes once.
 */
function Dial({ heading, bearing, aligned }: { heading: number; bearing: number; aligned: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const size = Math.min(width - spacing.xl * 2, 300);
  const qibla = hueColors(theme, "qibla");
  const [rotation] = useState(() => new Animated.Value(heading));
  const target = useRef(heading);
  const wasAligned = useRef(aligned);

  useEffect(() => {
    target.current = unwrapAngle(target.current, heading);
    if (reduced) {
      rotation.setValue(target.current);
      return;
    }
    const run = Animated.timing(rotation, {
      toValue: target.current,
      duration: 140,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [heading, rotation, reduced]);

  useEffect(() => {
    if (aligned && !wasAligned.current) Vibration.vibrate(60);
    wasAligned.current = aligned;
  }, [aligned]);

  const tone = aligned ? theme.accent : qibla.base;
  const spin = rotation.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "-360deg"],
    extrapolate: "extend",
  });
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t("ibadah.qibla.dialLabel", {
        heading: Math.round(heading),
        bearing: Math.round(bearing),
      })}
      style={styles.dialWrap}
    >
      <Ionicons name="caret-up" size={30} color={aligned ? theme.accent : theme.text} />
      <View style={{ width: size, height: size }}>
        <Animated.View
          style={[
            styles.rose,
            {
              borderRadius: size / 2,
              borderColor: aligned ? theme.accent : theme.border,
              backgroundColor: theme.surface,
              transform: [{ rotate: spin }],
            },
          ]}
        >
          {TICKS.map((angle) => {
            const major = angle % 90 === 0;
            const mid = angle % 30 === 0;
            return (
              <View
                key={angle}
                style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${angle}deg` }] }]}
              >
                <View
                  style={[
                    styles.tick,
                    {
                      height: major ? 16 : mid ? 11 : 6,
                      width: major ? 3 : mid ? 2 : 1,
                      backgroundColor: major ? theme.text : mid ? theme.muted : theme.faint,
                    },
                  ]}
                />
              </View>
            );
          })}
          {CARDINALS.map(({ angle, key }) => (
            <View
              key={key}
              style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${angle}deg` }] }]}
            >
              <Text
                style={[
                  styles.cardinal,
                  { color: key === "north" ? theme.danger : theme.muted },
                ]}
              >
                {t(`ibadah.qibla.${key}`)}
              </Text>
            </View>
          ))}
          <View
            style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${bearing}deg` }] }]}
          >
            <View style={[styles.needle, { height: size / 2 - 72, backgroundColor: tone }]} />
            <View style={[styles.kaaba, { top: 46 }]}>
              <View style={[styles.kaabaBand, { backgroundColor: theme.gold }]} />
            </View>
          </View>
          <View style={[styles.hub, { backgroundColor: tone }]} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md + 4, paddingTop: spacing.md, gap: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md - 4 },
  grow: { flex: 1 },
  bearingRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  bearing: { fontSize: 52, fontWeight: "800", letterSpacing: -1.5, lineHeight: 58 },
  tip: { paddingHorizontal: spacing.xs, textAlign: "center" },
  compass: { gap: spacing.md, alignItems: "stretch" },
  dialWrap: { alignItems: "center", gap: 2 },
  rose: { ...StyleSheet.absoluteFillObject, borderWidth: 2 },
  tick: { alignSelf: "center", marginTop: 6, borderRadius: 1 },
  cardinal: {
    alignSelf: "center",
    marginTop: 24,
    fontSize: 15,
    fontWeight: "800",
  },
  needle: {
    position: "absolute",
    bottom: "50%",
    alignSelf: "center",
    width: 4,
    borderRadius: 2,
  },
  kaaba: {
    position: "absolute",
    alignSelf: "center",
    width: 26,
    height: 26,
    borderRadius: 4,
    backgroundColor: "#141414",
    overflow: "hidden",
  },
  kaabaBand: { marginTop: 6, height: 4 },
  hub: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    top: "50%",
    left: "50%",
    marginTop: -7,
    marginLeft: -7,
  },
  status: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
});
