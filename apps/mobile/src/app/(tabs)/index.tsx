import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";

import { Checklist } from "@/components/today/Checklist";
import { LocationPrompt, NextPrayerCard, PrayerTimesList } from "@/components/today/PrayerCards";
import { StreakCard } from "@/components/today/StreakCard";
import { Section } from "@/components/ui";
import { HalaqahTodayRow } from "@/halaqah/components/HalaqahTodayRow";
import { useMutabaah, useNow } from "@/hooks/useMutabaah";
import { formatHijri } from "@/lib/hijri";
import { useTranslation } from "@/i18n";
import { refreshLocationIfStale } from "@/prayer/location";
import { nextSlot, timesFor } from "@/prayer/schedule";
import { spacing, useTheme } from "@/theme";

const MS_DAY = 86_400_000;

export default function TodayScreen() {
  const db = useSQLiteContext();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const model = useMutabaah();
  const now = useNow(15_000);

  useEffect(() => {
    void refreshLocationIfStale(db).catch(() => {});
  }, [db]);

  const settings = model?.settings;
  const location = settings?.location ?? null;
  const today = model?.today;

  const times = useMemo(
    () => (settings && location && today ? timesFor(settings, location, today).local : null),
    [settings, location, today],
  );
  const next = useMemo(
    () => (settings && location ? nextSlot(settings, location, now) : null),
    [settings, location, now],
  );

  const gregorian = new Intl.DateTimeFormat(i18n.language, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  const hijri = formatHijri(
    new Date(now.getTime() + (settings?.hijriOffset ?? 0) * MS_DAY),
    i18n.language,
  );

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.date, { color: theme.text }]}>{gregorian}</Text>
      {hijri ? <Text style={[styles.hijri, { color: theme.accent }]}>{hijri}</Text> : null}
      {!model ? (
        <Text style={{ color: theme.muted }}>{t("today.loading")}</Text>
      ) : (
        <>
          {location ? (
            <>
              {next ? <NextPrayerCard slot={next} now={now} timeZone={location.timeZone} /> : null}
              {times ? (
                <Section title={t("today.times")}>
                  <PrayerTimesList
                    times={times}
                    highlight={next && next.day === model.today ? next.prayer : null}
                  />
                </Section>
              ) : null}
            </>
          ) : (
            <LocationPrompt />
          )}
          <StreakCard streak={model.streak} />
          <HalaqahTodayRow />
          <Section title={t("today.checklist")}>
            <Checklist
              items={model.items}
              day={model.today}
              entries={model.todayEntries}
              prayerTimes={times}
            />
          </Section>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  date: { fontSize: 24, fontWeight: "700" },
  hijri: { fontSize: 18, fontWeight: "600" },
});
