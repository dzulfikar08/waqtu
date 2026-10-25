import {
  addDays,
  calculatePrayerTimes,
  civilParts,
  currentOrNextRamadhan,
  diffDays,
  fastingCountdown,
  isLastTenNights,
  ramadhanDay,
} from "@waqtu/core";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Row, Section } from "@/components/ui";
import { HalaqahCard } from "@/halaqah/components/HalaqahCard";
import { useTranslation } from "@/i18n";
import { PremiumGate } from "@/premium/PremiumGate";
import { spacing, useTheme } from "@/theme";
import { CountdownCard } from "@/ramadhan/components/CountdownCard";
import { DailyCard } from "@/ramadhan/components/DailyCard";
import { Hint, Panel } from "@/ramadhan/components/fields";
import { ImsakiyahCard } from "@/ramadhan/components/ImsakiyahCard";
import { KhatamCard } from "@/ramadhan/components/KhatamCard";
import { QadhaCard } from "@/ramadhan/components/QadhaCard";
import { ZakatCard } from "@/ramadhan/components/ZakatCard";
import type { RamadhanContext } from "@/ramadhan/context";
import { toIso } from "@/ramadhan/dates";
import { formatCivilDate } from "@/ramadhan/format";
import { readHijriOffset, readPrayerConfig, type PrayerConfig } from "@/ramadhan/prayerConfig";
import { useNow } from "@/ramadhan/useNow";

interface Loaded {
  config: PrayerConfig | null;
  hijriOffset: number;
}

export default function RamadhanScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const now = useNow(1000);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  // Settings may have changed in another tab, so reload whenever this screen gains focus.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all([readPrayerConfig(db), readHijriOffset(db)])
        .then(([config, hijriOffset]) => {
          if (!cancelled) setLoaded({ config, hijriOffset });
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [db]),
  );

  const config = loaded?.config ?? null;
  const hijriOffset = loaded?.hijriOffset ?? 0;
  const timeZone = config?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = civilParts(now, timeZone);
  const todayIso = toIso(today);

  const ctx = useMemo<RamadhanContext>(
    () => ({
      hijriOffset,
      timeZone,
      today,
      todayIso,
      span: currentOrNextRamadhan(today, hijriOffset),
    }),
    // `today` is derived from `todayIso`.
    [hijriOffset, timeZone, todayIso],
  );

  const times = useMemo(() => {
    if (!config) return null;
    const input = {
      latitude: config.latitude,
      longitude: config.longitude,
      timeZone: config.timeZone,
      method: config.method,
      asr: config.asr,
      offsets: config.offsets,
    };
    return {
      today: calculatePrayerTimes({ ...input, date: ctx.today }),
      tomorrow: calculatePrayerTimes({ ...input, date: addDays(ctx.today, 1) }),
    };
  }, [config, ctx.today]);

  if (!loaded) return null;

  const countdown = times ? fastingCountdown(now, times.today, times.tomorrow) : null;
  const maghrib = times?.today.times.maghrib ?? null;
  const afterMaghrib = maghrib !== null && now >= maghrib;
  const night = isLastTenNights(ctx.today, hijriOffset, afterMaghrib)
    ? ramadhanDay(afterMaghrib ? addDays(ctx.today, 1) : ctx.today, hijriOffset)
    : null;
  const locale = i18n.language;
  const day = ramadhanDay(ctx.today, hijriOffset);
  const daysUntil = diffDays(ctx.today, ctx.span.start);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>
          {day !== null
            ? t("ramadhan.dayOf", { day, year: ctx.span.hijriYear })
            : t("ramadhan.startsIn", { count: daysUntil, year: ctx.span.hijriYear })}
        </Text>
        <Text style={{ color: theme.muted }}>
          {day !== null
            ? t("ramadhan.eidOn", { date: formatCivilDate(ctx.span.eid, locale) })
            : t("ramadhan.startsOn", {
                date: formatCivilDate(ctx.span.start, locale),
                year: ctx.span.hijriYear,
              })}
        </Text>
      </View>

      {config ? (
        <CountdownCard now={now} countdown={countdown} timeZone={config.timeZone} />
      ) : (
        <Section title={t("ramadhan.tab")}>
          <Panel>
            <Hint>{t("ramadhan.needLocation")}</Hint>
          </Panel>
          <Row label={t("tabs.settings")} onPress={() => router.push("/settings")} />
        </Section>
      )}

      <DailyCard ctx={ctx} night={night} />
      <HalaqahCard />
      {/* Free: countdown, daily worship, imsakiyah. Premium: the khatam, qadha and zakat trackers. */}
      <PremiumGate>
        <KhatamCard ctx={ctx} locale={locale} />
      </PremiumGate>
      {config ? <ImsakiyahCard ctx={ctx} config={config} /> : null}
      <PremiumGate>
        <QadhaCard ctx={ctx} locale={locale} />
        <ZakatCard ctx={ctx} locale={locale} />
      </PremiumGate>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.lg },
  header: { gap: spacing.xs, paddingHorizontal: spacing.sm },
  title: { fontSize: 24, fontWeight: "700" },
});
