import { diffDays, khatamPlan } from "@waqtu/core";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { useTheme } from "@/theme";
import { formatCivilDate, formatNumber } from "../format";
import { toIso } from "../dates";
import type { RamadhanContext } from "../context";
import {
  deleteKhatam,
  getKhatam,
  getPagesBefore,
  getPagesOn,
  saveKhatam,
  setPagesOn,
  type StoredKhatam,
} from "../db";
import { Button, ButtonRow, Heading, Hint, NumberField, Panel, ProgressBar } from "./fields";

const QUICK_ADD = [1, 5, 10] as const;

export function KhatamCard({ ctx, locale }: { ctx: RamadhanContext; locale: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const db = useSQLiteContext();
  const { span, today, todayIso } = ctx;
  const startIso = toIso(span.start);
  const endIso = toIso(span.end);
  const [stored, setStored] = useState<StoredKhatam | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pagesBefore, setPagesBefore] = useState(0);
  const [pagesToday, setPagesToday] = useState(0);
  const [draftTarget, setDraftTarget] = useState(1);

  const reload = useCallback(async () => {
    const plan = await getKhatam(db, span.hijriYear);
    setStored(plan);
    if (plan) {
      setPagesBefore(await getPagesBefore(db, plan.startDate, todayIso));
      setPagesToday(await getPagesOn(db, todayIso));
    }
    setLoaded(true);
  }, [db, span.hijriYear, todayIso]);

  useEffect(() => {
    void reload().catch(() => setLoaded(true));
  }, [reload]);

  const plan = useMemo(
    () =>
      stored
        ? khatamPlan({
            targetKhatam: stored.target,
            start: span.start,
            end: span.end,
            today,
            pagesReadBeforeToday: pagesBefore,
            pagesReadToday: pagesToday,
          })
        : null,
    [stored, span, today, pagesBefore, pagesToday],
  );

  const preview = useMemo(
    () =>
      khatamPlan({
        targetKhatam: draftTarget,
        start: span.start,
        end: span.end,
        today: span.start,
        pagesReadBeforeToday: 0,
      }),
    [draftTarget, span],
  );

  const logging = diffDays(span.start, today) >= 0;
  const ended = plan !== null && plan.daysLeft === 0;

  const setToday = async (pages: number) => {
    const next = Math.max(0, Math.floor(pages));
    setPagesToday(next);
    await setPagesOn(db, todayIso, next).catch(() => {});
  };

  if (!loaded) return null;

  return (
    <Section title={t("ramadhan.khatam.title")}>
      <Panel>
        {stored === null || plan === null ? (
          <>
            <Hint>{t("ramadhan.khatam.target")}</Hint>
            <ButtonRow>
              <Button
                tone="plain"
                label="−"
                onPress={() => setDraftTarget((n) => Math.max(1, n - 1))}
              />
              <Text style={[styles.target, { color: theme.text }]}>
                {t("ramadhan.khatam.targetValue", { count: draftTarget })}
              </Text>
              <Button
                tone="plain"
                label="+"
                onPress={() => setDraftTarget((n) => Math.min(20, n + 1))}
              />
            </ButtonRow>
            <Button
              label={t("ramadhan.khatam.start")}
              onPress={() =>
                void saveKhatam(db, span.hijriYear, draftTarget, startIso).then(reload)
              }
            />
            <Hint>
              {t("ramadhan.khatam.daily")}:{" "}
              {t("ramadhan.khatam.dailyValue", {
                pages: preview.dailyTarget,
                juz: formatNumber(preview.dailyJuz, locale, 1),
              })}
            </Hint>
          </>
        ) : (
          <>
            <Heading>
              {t("ramadhan.khatam.progress", { read: plan.pagesRead, total: plan.totalPages })}
            </Heading>
            <ProgressBar fraction={plan.pagesRead / plan.totalPages} />
            <Hint>{t("ramadhan.khatam.daysLeft", { count: plan.daysLeft })}</Hint>
            {plan.completed ? (
              <Text style={{ color: theme.accent, fontWeight: "600" }}>
                {t("ramadhan.khatam.completed")}
              </Text>
            ) : ended ? (
              <Text style={{ color: theme.text }}>
                {t("ramadhan.khatam.ended", { pages: plan.pagesRemaining })}
              </Text>
            ) : (
              <>
                <Text style={{ color: theme.text, fontSize: 16 }}>
                  {t("ramadhan.khatam.daily")}:{" "}
                  {t("ramadhan.khatam.dailyValue", {
                    pages: plan.dailyTarget,
                    juz: formatNumber(plan.dailyJuz, locale, 1),
                  })}
                </Text>
                <Text
                  style={{
                    color: plan.todayRemaining === 0 ? theme.accent : theme.text,
                    fontWeight: "600",
                  }}
                >
                  {plan.todayRemaining === 0
                    ? t("ramadhan.khatam.doneToday")
                    : t("ramadhan.khatam.remainingToday", { pages: plan.todayRemaining })}
                </Text>
                {plan.rebalanced ? (
                  <Hint>
                    {t("ramadhan.khatam.rebalanced", {
                      behind: plan.pagesBehind,
                      from: plan.originalDailyTarget,
                      to: plan.dailyTarget,
                    })}
                  </Hint>
                ) : null}
              </>
            )}
            {logging && !ended ? (
              <>
                <NumberField
                  label={t("ramadhan.khatam.todayPages")}
                  value={pagesToday}
                  onChangeNumber={(v) => void setToday(v ?? 0)}
                />
                <ButtonRow>
                  {QUICK_ADD.map((n) => (
                    <Button
                      key={n}
                      tone="plain"
                      label={`+${n}`}
                      onPress={() => void setToday(pagesToday + n)}
                    />
                  ))}
                </ButtonRow>
              </>
            ) : null}
            {!logging ? (
              <Hint>
                {t("ramadhan.khatam.notStarted", { date: formatCivilDate(span.start, locale) })}
              </Hint>
            ) : null}
            <Button
              tone="plain"
              label={t("ramadhan.khatam.reset")}
              onPress={() => void deleteKhatam(db, span.hijriYear, startIso, endIso).then(reload)}
            />
          </>
        )}
      </Panel>
    </Section>
  );
}

const styles = StyleSheet.create({
  target: { fontSize: 18, fontWeight: "600", minWidth: 100, textAlign: "center" },
});
