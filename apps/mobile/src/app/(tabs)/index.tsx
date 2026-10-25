import { Ionicons } from "@expo/vector-icons";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Checklist } from "@/components/today/Checklist";
import { LocationPrompt, NextPrayerHero, PrayerTimesList } from "@/components/today/PrayerCards";
import { StreakCard } from "@/components/today/StreakCard";
import { Screen, Section, SectionTitle } from "@/components/ui";
import { HafalanCard } from "@/hafalan/components/HafalanCard";
import { HalaqahTodayRow } from "@/halaqah/components/HalaqahTodayRow";
import { useMutabaah, useNow } from "@/hooks/useMutabaah";
import { formatHijri } from "@/lib/hijri";
import { useTranslation } from "@/i18n";
import { refreshLocationIfStale } from "@/prayer/location";
import { periodAt, periodForHour } from "@/prayer/period";
import { nextSlot, timesFor } from "@/prayer/schedule";
import { prayerTone, skyTone, spacing, typography, useTheme } from "@/theme";

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
  const span = useMemo(
    () => (settings && location ? periodAt(settings, location, now) : null),
    [settings, location, now],
  );
  const period = span?.period ?? periodForHour(now.getHours());

  const gregorian = new Intl.DateTimeFormat(i18n.language, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  const hijri = formatHijri(
    new Date(now.getTime() + (settings?.hijriOffset ?? 0) * MS_DAY),
    i18n.language,
  );

  const tone = prayerTone(period, theme.dark);
  const eyebrow = location?.name ? (
    <View style={[styles.place, { backgroundColor: `${tone}${theme.dark ? "2E" : "1F"}` }]}>
      <Ionicons name="location" size={13} color={tone} />
      <Text style={[typography.footnote, { color: theme.text, fontWeight: "700" }]}>
        {location.name}
      </Text>
    </View>
  ) : null;
  const caption = hijri ? (
    <View style={styles.eyebrow}>
      <Ionicons name="moon" size={13} color={theme.gold} />
      <Text style={[typography.callout, { color: theme.gold, fontWeight: "600" }]}>{hijri}</Text>
    </View>
  ) : null;
  const sky = skyTone(period, theme.dark);
  const backdrop = (
    <View
      style={[
        styles.backdrop,
        {
          experimental_backgroundImage: `linear-gradient(180deg, ${sky}${theme.dark ? "73" : "40"} 0%, ${sky}00 100%)`,
        },
      ]}
    />
  );

  return (
    <Screen title={gregorian} eyebrow={eyebrow} caption={caption} backdrop={backdrop}>
      {!model ? (
        <Text style={{ color: theme.muted }}>{t("today.loading")}</Text>
      ) : (
        <>
          {location ? (
            <>
              {next ? (
                <NextPrayerHero slot={next} span={span} timeZone={location.timeZone} />
              ) : null}
              {times ? (
                <View style={styles.block}>
                  <SectionTitle title={t("today.times")} icon="time-outline" hue="prayer" />
                  <PrayerTimesList
                    times={times}
                    highlight={next && next.day === model.today ? next.prayer : null}
                    allPassed={next !== null && next.day !== model.today}
                  />
                </View>
              ) : null}
            </>
          ) : (
            <LocationPrompt period={period} />
          )}
          <StreakCard streak={model.streak} days={model.week.days} today={model.today} />
          <HalaqahTodayRow />
          <HafalanCard />
          <Section title={t("today.checklist")} icon="checkbox-outline" hue="brand">
            <Checklist
              items={model.items}
              day={model.today}
              entries={model.todayEntries}
              prayerTimes={times}
            />
          </Section>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 5, marginVertical: 2 },
  place: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: spacing.xs,
  },
  backdrop: { height: 420 },
  block: { gap: spacing.sm },
});
