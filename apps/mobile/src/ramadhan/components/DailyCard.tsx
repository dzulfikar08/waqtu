import { isOddNight, ramadhanDay } from "@waqtu/core";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { radius, spacing, useTheme } from "@/theme";
import { countDaily, DAILY_KEYS, getDaily, setDaily, type DailyChecks, type DailyKey } from "../db";
import { toIso } from "../dates";
import type { RamadhanContext } from "../context";
import { Hint, Panel, ToggleRow } from "./fields";

const EMPTY: DailyChecks = { puasa: false, tarawih: false, tadarus: false, itikaf: false };

/**
 * Daily puasa/tarawih/tadarus/i'tikaf checks. In the last ten nights the i'tikaf row and the night
 * banner (with the Laylatul Qadr dua) appear: `night` is the Ramadhan night now beginning or in
 * progress, or null when it is not one of the last ten.
 */
export function DailyCard({ ctx, night }: { ctx: RamadhanContext; night: number | null }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const db = useSQLiteContext();
  const [checks, setChecks] = useState<DailyChecks>(EMPTY);
  const [fasted, setFasted] = useState(0);
  const { todayIso, span } = ctx;
  const startIso = toIso(span.start);
  const endIso = toIso(span.end);

  const reload = useCallback(async () => {
    setChecks(await getDaily(db, todayIso));
    setFasted(await countDaily(db, "puasa", startIso, endIso));
  }, [db, todayIso, startIso, endIso]);

  useEffect(() => {
    void reload().catch(() => {});
  }, [reload]);

  const toggle = async (key: DailyKey, value: boolean) => {
    setChecks((c) => ({ ...c, [key]: value }));
    try {
      await setDaily(db, todayIso, key, value);
      await reload();
    } catch {
      await reload();
    }
  };

  const keys = DAILY_KEYS.filter((k) => k !== "itikaf" || night !== null);
  const day = ramadhanDay(ctx.today, ctx.hijriOffset);

  return (
    <>
      {night !== null ? (
        <Section title={t("ramadhan.lastTen.title")}>
          <Panel>
            <View
              style={[
                styles.banner,
                { backgroundColor: theme.background, borderColor: theme.accent },
              ]}
            >
              <Text style={[styles.night, { color: theme.accent }]}>
                {t("ramadhan.lastTen.night", { night })}
              </Text>
              <Text style={{ color: theme.text }}>
                {t(isOddNight(night) ? "ramadhan.lastTen.odd" : "ramadhan.lastTen.even")}
              </Text>
            </View>
            <Hint>{t("ramadhan.lastTen.duaLabel")}</Hint>
            <Text style={[styles.arabic, { color: theme.text }]}>
              {t("ramadhan.lastTen.duaArabic")}
            </Text>
            <Hint>{t("ramadhan.lastTen.duaMeaning")}</Hint>
          </Panel>
        </Section>
      ) : null}
      <Section title={t("ramadhan.daily.title")}>
        {keys.map((key) => (
          <ToggleRow
            key={key}
            label={t(`ramadhan.daily.${key}`)}
            value={checks[key]}
            onValueChange={(v) => void toggle(key, v)}
          />
        ))}
        <Panel>
          <Hint>
            {day === null
              ? t("ramadhan.daily.notRamadhan")
              : t("ramadhan.daily.fastedCount", { count: fasted, year: span.hijriYear })}
          </Hint>
        </Panel>
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  banner: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  night: { fontSize: 20, fontWeight: "700" },
  arabic: { fontSize: 24, lineHeight: 40, textAlign: "right", writingDirection: "rtl" },
});
