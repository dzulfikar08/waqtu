import {
  addIsoDays,
  DEFAULT_MAX_REVIEW_PER_DAY,
  isValidTarget,
  type HafalanTarget,
  type IsoDay,
} from "@waqtu/core";
import { useSQLiteContext } from "expo-sqlite";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Row, Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { Button, Hint, NumberField, Panel } from "@/ramadhan/components/fields";
import { spacing, useTheme } from "@/theme";
import { savePlan, planUnits } from "../db";
import { pagesSpanned, targetFromInput } from "../format";
import { removeRecordings } from "../recordings";

const KINDS = ["surah", "juz", "pages"] as const;

/** Creates the plan: a range of surahs, juz or pages, and the number of days to finish it in. */
export function PlanForm({ today }: { today: IsoDay }) {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const theme = useTheme();
  const [kind, setKind] = useState<HafalanTarget["kind"]>("juz");
  const [from, setFrom] = useState<number | null>(30);
  const [to, setTo] = useState<number | null>(null);
  const [days, setDays] = useState<number | null>(30);

  const target = targetFromInput(kind, from, to);
  const valid = target !== null && isValidTarget(target);
  const dayCount = days !== null && days >= 1 ? Math.min(Math.trunc(days), 3650) : null;

  const preview = useMemo(() => {
    if (!target || !valid) return null;
    const units = planUnits({ target, startDay: today, deadline: today, maxReviewPerDay: 1 });
    return { units: units.length, pages: pagesSpanned(units) };
  }, [target, valid, today]);

  const start = async () => {
    if (!target || !valid || dayCount === null) return;
    const files = await savePlan(db, {
      target,
      startDay: today,
      deadline: addIsoDays(today, dayCount - 1),
      maxReviewPerDay: DEFAULT_MAX_REVIEW_PER_DAY,
    });
    removeRecordings(files);
  };

  return (
    <Section title={t("hafalan.newPlan")}>
      {KINDS.map((k) => (
        <Row
          key={k}
          label={t(`hafalan.kind.${k}`)}
          selected={kind === k}
          onPress={() => {
            setKind(k);
            setFrom(null);
            setTo(null);
          }}
        />
      ))}
      <Panel>
        <NumberField label={t("hafalan.from")} value={from} onChangeNumber={setFrom} />
        <NumberField label={t("hafalan.to")} value={to} onChangeNumber={setTo} />
        <NumberField label={t("hafalan.days")} value={days} onChangeNumber={setDays} />
        {from !== null && !valid ? (
          <Text style={{ color: theme.muted }}>{t("hafalan.invalidTarget")}</Text>
        ) : null}
        {preview && dayCount !== null ? (
          <View style={styles.preview}>
            <Text style={{ color: theme.text }}>
              {t("hafalan.preview", { units: preview.units, pages: preview.pages })}
            </Text>
            <Text style={{ color: theme.accent, fontWeight: "600" }}>
              {t("hafalan.perDay", { count: Math.ceil(preview.units / dayCount) })}
            </Text>
            <Hint>{t("hafalan.partNote")}</Hint>
          </View>
        ) : null}
        <Button
          label={t("hafalan.start")}
          disabled={!valid || dayCount === null}
          onPress={() => void start()}
        />
      </Panel>
    </Section>
  );
}

const styles = StyleSheet.create({ preview: { gap: spacing.xs } });
