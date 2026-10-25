import { Ionicons } from "@expo/vector-icons";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Checklist } from "@/components/today/Checklist";
import { LocationPrompt, NextPrayerCard, PrayerTimesList } from "@/components/today/PrayerCards";
import { StreakCard } from "@/components/today/StreakCard";
import { Screen, Section, SectionTitle } from "@/components/ui";
import { HafalanCard } from "@/hafalan/components/HafalanCard";
import { HalaqahTodayRow } from "@/halaqah/components/HalaqahTodayRow";
import { useMutabaah, useNow } from "@/hooks/useMutabaah";
import { formatHijri } from "@/lib/hijri";
import { useTranslation } from "@/i18n";
import { FLAG } from "@/mutabaah/items";
import { refreshLocationIfStale } from "@/prayer/location";
import { nextSlot, timesFor } from "@/prayer/schedule";
import { spacing, tabular, typography, useTheme } from "@/theme";

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
  }).format(now);
  const hijri = formatHijri(
    new Date(now.getTime() + (settings?.hijriOffset ?? 0) * MS_DAY),
    i18n.language,
  );

  const eyebrow = location?.name ? (
    <View style={styles.eyebrow}>
      <Ionicons name="location" size={14} color={theme.accent} />
      <Text style={[typography.subhead, { color: theme.muted, fontWeight: "600" }]}>
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

  const done = model
    ? model.items.filter((item) => {
        const value = model.todayEntries.get(item.id) ?? 0;
        return item.kind === "fardh" ? (value & FLAG.DONE) !== 0 : value > 0;
      }).length
    : 0;

  return (
    <Screen title={gregorian} eyebrow={eyebrow} caption={caption}>
      {!model ? (
        <Text style={{ color: theme.muted }}>{t("today.loading")}</Text>
      ) : (
        <>
          {location ? (
            <>
              {next ? (
                <NextPrayerCard
                  slot={next}
                  now={now}
                  timeZone={location.timeZone}
                  place={location.name ?? undefined}
                />
              ) : null}
              {times ? (
                <View style={styles.block}>
                  <SectionTitle title={t("today.times")} icon="time-outline" />
                  <PrayerTimesList
                    times={times}
                    highlight={next && next.day === model.today ? next.prayer : null}
                    allPassed={next !== null && next.day !== model.today}
                  />
                </View>
              ) : null}
            </>
          ) : (
            <LocationPrompt />
          )}
          <StreakCard streak={model.streak} />
          <HalaqahTodayRow />
          <HafalanCard />
          <Section
            title={t("today.checklist")}
            icon="checkbox-outline"
            right={
              model.items.length > 0 ? (
                <Text
                  style={[typography.footnote, tabular, { color: theme.accent, fontWeight: "700" }]}
                >
                  {done}/{model.items.length}
                </Text>
              ) : null
            }
          >
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
  block: { gap: spacing.sm },
});
