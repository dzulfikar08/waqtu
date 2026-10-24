import { imsakiyahTable, type ImsakiyahRow, type PrayerName } from "@waqtu/core";
import * as Sharing from "expo-sharing";
import { useMemo, useRef, useState, type Ref } from "react";
import { StyleSheet, Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { lightTheme, radius, spacing, useTheme } from "@/theme";
import type { RamadhanContext } from "../context";
import type { PrayerConfig } from "../prayerConfig";
import { toIso } from "../dates";
import { Button, Hint, Panel } from "./fields";

const COLUMNS = [
  "imsak",
  "fajr",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
] as const satisfies readonly PrayerName[];

/** Table of a Hijri month's prayer times, plus sharing it as a PNG. */
export function ImsakiyahCard({ ctx, config }: { ctx: RamadhanContext; config: PrayerConfig }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { span, hijriOffset, todayIso } = ctx;
  const captureTarget = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"unavailable" | "failed" | null>(null);

  const rows = useMemo(
    () =>
      imsakiyahTable({
        latitude: config.latitude,
        longitude: config.longitude,
        timeZone: config.timeZone,
        method: config.method,
        asr: config.asr,
        offsets: config.offsets,
        hijriYear: span.hijriYear,
        hijriOffset,
      }),
    [config, span.hijriYear, hijriOffset],
  );

  const share = async () => {
    setError(null);
    if (!(await Sharing.isAvailableAsync())) {
      setError("unavailable");
      return;
    }
    setBusy(true);
    try {
      const uri = await captureRef(captureTarget, { format: "png", quality: 1, result: "tmpfile" });
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        UTI: "public.png",
        dialogTitle: t("ramadhan.imsakiyah.shareTitle"),
      });
    } catch {
      setError("failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={t("ramadhan.imsakiyah.title")}>
      <Panel>
        <ImsakiyahTable
          ref={captureTarget}
          rows={rows}
          todayIso={todayIso}
          heading={t("ramadhan.imsakiyah.heading", { year: span.hijriYear })}
          place={
            config.locationName ?? `${config.latitude.toFixed(2)}, ${config.longitude.toFixed(2)}`
          }
        />
        <Button
          label={t(busy ? "ramadhan.imsakiyah.sharing" : "ramadhan.imsakiyah.share")}
          onPress={() => void share()}
          disabled={busy}
        />
        {error ? (
          <Hint>
            {t(
              error === "unavailable"
                ? "ramadhan.imsakiyah.shareUnavailable"
                : "ramadhan.imsakiyah.shareFailed",
            )}
          </Hint>
        ) : null}
        <Text style={{ color: theme.muted, fontSize: 12 }}>{config.timeZone}</Text>
      </Panel>
    </Section>
  );
}

/**
 * The shared image. Always the light palette so it reads the same on any phone, whatever the viewer's
 * theme, and sized by the screen width: 8 columns fit without scrolling, so the whole month is captured.
 */
function ImsakiyahTable({
  ref,
  rows,
  todayIso,
  heading,
  place,
}: {
  ref: Ref<View>;
  rows: ImsakiyahRow[];
  todayIso: string;
  heading: string;
  place: string;
}) {
  const { t } = useTranslation();
  const colors = lightTheme;
  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text style={[styles.title, { color: colors.text }]}>{heading}</Text>
      <Text style={[styles.place, { color: colors.muted }]}>{place}</Text>
      <View style={[styles.row, styles.headRow, { backgroundColor: colors.accent }]}>
        <Text style={[styles.cell, styles.narrow, styles.head]}>{t("ramadhan.imsakiyah.day")}</Text>
        <Text style={[styles.cell, styles.narrow, styles.head]}>
          {t("ramadhan.imsakiyah.date")}
        </Text>
        {COLUMNS.map((c) => (
          <Text key={c} style={[styles.cell, styles.head]}>
            {t(`ramadhan.imsakiyah.${c}`)}
          </Text>
        ))}
      </View>
      {rows.map((row, i) => {
        const today = toIso(row.date) === todayIso;
        return (
          <View
            key={row.hijriDay}
            style={[
              styles.row,
              { backgroundColor: today ? "#DCEFEA" : i % 2 === 1 ? "#F4F6F8" : colors.surface },
            ]}
          >
            <Text
              style={[styles.cell, styles.narrow, today && styles.today, { color: colors.text }]}
            >
              {row.hijriDay}
            </Text>
            <Text
              style={[styles.cell, styles.narrow, today && styles.today, { color: colors.text }]}
            >
              {row.date.day}/{row.date.month}
            </Text>
            {COLUMNS.map((c) => (
              <Text key={c} style={[styles.cell, today && styles.today, { color: colors.text }]}>
                {row.local[c] ?? "—"}
              </Text>
            ))}
          </View>
        );
      })}
      <Text style={[styles.footer, { color: colors.muted }]}>{t("ramadhan.imsakiyah.footer")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 0,
  },
  title: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  place: { fontSize: 12, textAlign: "center", marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 3 },
  headRow: { borderRadius: 4 },
  cell: { flex: 1.25, fontSize: 11, textAlign: "center", fontVariant: ["tabular-nums"] },
  narrow: { flex: 0.9 },
  head: { color: "#FFFFFF", fontWeight: "700" },
  today: { fontWeight: "700" },
  footer: { fontSize: 11, textAlign: "center", marginTop: spacing.sm },
});
