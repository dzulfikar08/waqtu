import { FIDYAH_MUD_RICE_KG, fidyah, type Rate } from "@waqtu/core";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Divider, IconChip, Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { spacing } from "@/theme";
import type { RamadhanContext } from "../context";
import { addQadha, getQadhaTotals, undoQadha, type QadhaTotals } from "../db";
import { formatNumber, formatRupiah } from "../format";
import { KEYS } from "../settings";
import { useStoredMode } from "../useStoredMode";
import { useStoredNumber } from "../useStoredNumber";
import { Button, ButtonRow, Heading, Hint, NumberField, Panel } from "./fields";
import { ResultBox, ResultDetail, ResultFigure, Stat, StatRow } from "./figures";

const NO_TOTALS: QadhaTotals = { owed: 0, madeUp: 0, remaining: 0 };

/** Qadha puasa ledger, with the fidyah for days that cannot be made up. */
export function QadhaCard({ ctx, locale }: { ctx: RamadhanContext; locale: string }) {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const [totals, setTotals] = useState<QadhaTotals>(NO_TOTALS);
  const [count, setCount] = useState<number | null>(1);

  const reload = useCallback(async () => setTotals(await getQadhaTotals(db)), [db]);
  useEffect(() => {
    void reload().catch(() => {});
  }, [reload]);

  const log = async (kind: "owed" | "made_up") => {
    if (!count || !Number.isInteger(count)) return;
    await addQadha(db, kind, count, ctx.todayIso).catch(() => {});
    await reload().catch(() => {});
  };

  const remainingDays = t("ramadhan.qadha.days", { count: totals.remaining });

  return (
    <Section title={t("ramadhan.qadha.title")} icon="calendar-clear-outline">
      <Panel>
        <StatRow>
          <Stat
            label={t("ramadhan.qadha.remaining")}
            value={totals.remaining}
            accessibilityLabel={`${t("ramadhan.qadha.remaining")}: ${remainingDays}`}
            highlight
          />
          <Stat label={t("ramadhan.qadha.owed")} value={totals.owed} />
          <Stat label={t("ramadhan.qadha.madeUp")} value={totals.madeUp} />
        </StatRow>
        {totals.owed === 0 ? <Hint>{t("ramadhan.qadha.none")}</Hint> : null}
        <NumberField label={t("ramadhan.qadha.count")} value={count} onChangeNumber={setCount} />
        <ButtonRow>
          <Button
            label={t("ramadhan.qadha.addOwed")}
            onPress={() => void log("owed")}
            disabled={!count}
          />
          <Button
            tone="plain"
            label={t("ramadhan.qadha.addMadeUp")}
            onPress={() => void log("made_up")}
            disabled={!count}
          />
        </ButtonRow>
        {totals.owed > 0 ? (
          <Button
            tone="plain"
            label={t("ramadhan.qadha.undo")}
            onPress={() => void undoQadha(db).then(reload)}
          />
        ) : null}
      </Panel>
      <Divider />
      <FidyahPanel remaining={totals.remaining} locale={locale} />
    </Section>
  );
}

function FidyahPanel({ remaining, locale }: { remaining: number; locale: string }) {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const { mode, set: setMode } = useStoredMode(db, KEYS.fidyahMode);
  const kg = useStoredNumber(db, KEYS.fidyahKg, FIDYAH_MUD_RICE_KG);
  const pricePerKg = useStoredNumber(db, KEYS.fidyahPrice, null);
  const cash = useStoredNumber(db, KEYS.fidyahCash, null);
  // undefined follows the remaining qadha days; the user's own number (or an emptied field) overrides it.
  const [days, setDays] = useState<number | null | undefined>(undefined);

  const dueDays = days === undefined ? remaining : days;
  const result = useMemo(() => {
    if (dueDays === null || !Number.isInteger(dueDays)) return null;
    const rate: Rate =
      mode === "cash"
        ? { kind: "cash", amount: cash.value ?? 0 }
        : {
            kind: "rice",
            kgPer: kg.value && kg.value > 0 ? kg.value : undefined,
            pricePerKg: pricePerKg.value ?? undefined,
          };
    return fidyah(dueDays, rate);
  }, [dueDays, mode, kg.value, cash.value, pricePerKg.value]);
  const priceField = mode === "cash" ? cash : pricePerKg;
  const showAmount = result?.amount != null && (mode === "cash" || (pricePerKg.value ?? 0) > 0);

  return (
    <Panel>
      <View style={styles.heading}>
        <IconChip icon="basket-outline" />
        <Heading>{t("ramadhan.fidyah.title")}</Heading>
      </View>
      <Hint>{t("ramadhan.fidyah.hint")}</Hint>
      <ButtonRow>
        <Button
          tone={mode === "rice" ? "primary" : "plain"}
          label={t("ramadhan.fidyah.rice")}
          onPress={() => setMode("rice")}
        />
        <Button
          tone={mode === "cash" ? "primary" : "plain"}
          label={t("ramadhan.fidyah.cash")}
          onPress={() => setMode("cash")}
        />
      </ButtonRow>
      <NumberField label={t("ramadhan.fidyah.days")} value={dueDays} onChangeNumber={setDays} />
      {mode === "rice" ? (
        <>
          <NumberField
            label={t("ramadhan.fidyah.kgPerDay")}
            value={kg.value}
            decimal
            suffix="kg"
            onChangeNumber={kg.set}
          />
          <Hint>{t("ramadhan.fidyah.kgHint")}</Hint>
        </>
      ) : null}
      <NumberField
        label={t(mode === "rice" ? "ramadhan.fidyah.pricePerKg" : "ramadhan.fidyah.cashPerDay")}
        value={priceField.value}
        suffix="Rp"
        onChangeNumber={priceField.set}
      />
      {result && (result.riceKg !== null || showAmount) ? (
        <ResultBox icon={mode === "rice" ? "basket-outline" : "cash-outline"}>
          {result.riceKg !== null ? (
            <ResultFigure>
              {t("ramadhan.fidyah.resultRice", { kg: formatNumber(result.riceKg, locale, 3) })}
            </ResultFigure>
          ) : null}
          {result.amount !== null && showAmount ? (
            result.riceKg !== null ? (
              <ResultDetail>
                {t("ramadhan.fidyah.resultAmount", { amount: formatRupiah(result.amount, locale) })}
              </ResultDetail>
            ) : (
              <ResultFigure>
                {t(
                  mode === "cash" ? "ramadhan.fidyah.resultCash" : "ramadhan.fidyah.resultAmount",
                  { amount: formatRupiah(result.amount, locale) },
                )}
              </ResultFigure>
            )
          ) : null}
        </ResultBox>
      ) : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: "row", alignItems: "center", gap: spacing.md - 4 },
});
