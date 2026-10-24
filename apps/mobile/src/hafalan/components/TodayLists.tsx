import { useRouter } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { Row, Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { Hint } from "@/ramadhan/components/fields";
import { spacing, useTheme } from "@/theme";
import { unitLabel } from "../format";
import type { HafalanData } from "../useHafalan";

/** Today's new portion and murojaah as tappable rows; finished ones carry a check. */
export function TodayLists({ data }: { data: HafalanData }) {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const { portion, units, states } = data;
  const dueBefore = (unit: number) => {
    const due = states.find((s) => s.unit === unit)?.due;
    return due !== null && due !== undefined && due < portion.day;
  };
  const open = (unit: number) =>
    router.push({ pathname: "/hafalan/[unit]", params: { unit: String(unit) } });
  const label = (unit: number, suffix?: string) =>
    `${unitLabel(units[unit])} · ${t("hafalan.page", { page: units[unit].page })}${suffix ? ` · ${suffix}` : ""}`;

  const sabaq = [...portion.sabaq.done, ...portion.sabaq.todo];
  const murojaah = [...portion.murojaah.done, ...portion.murojaah.todo];
  return (
    <>
      <Section title={t("hafalan.sabaq")}>
        {sabaq.length === 0 ? (
          <Text style={[styles.none, { color: theme.muted }]}>{t("hafalan.noneToday")}</Text>
        ) : (
          sabaq.map((unit) => (
            <Row
              key={unit}
              label={label(unit)}
              selected={portion.sabaq.done.includes(unit)}
              onPress={() => open(unit)}
            />
          ))
        )}
      </Section>
      <Section title={t("hafalan.murojaah")}>
        {murojaah.length === 0 ? (
          <Text style={[styles.none, { color: theme.muted }]}>{t("hafalan.noneToday")}</Text>
        ) : (
          murojaah.map((unit) => (
            <Row
              key={unit}
              label={label(unit, dueBefore(unit) ? t("hafalan.overdue") : undefined)}
              selected={portion.murojaah.done.includes(unit)}
              onPress={() => open(unit)}
            />
          ))
        )}
      </Section>
      {portion.murojaah.deferred > 0 ? (
        <Hint>{t("hafalan.deferred", { count: portion.murojaah.deferred })}</Hint>
      ) : null}
      {portion.complete ? (
        <Text style={{ color: theme.accent, fontWeight: "600" }}>{t("hafalan.dayComplete")}</Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({ none: { padding: spacing.md } });
