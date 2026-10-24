import { zakatFitrah, type Rate } from "@waqtu/core";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";

import { Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { requestNotificationPermission } from "@/notifications/setup";
import { useTheme } from "@/theme";
import type { RamadhanContext } from "../context";
import { formatNumber, formatRupiah } from "../format";
import { cancelZakatReminders, scheduleZakatReminders } from "../reminders";
import { getSetting, KEYS, setSetting } from "../settings";
import { useStoredMode } from "../useStoredMode";
import { useStoredNumber } from "../useStoredNumber";
import { Button, ButtonRow, Heading, Hint, NumberField, Panel, ToggleRow } from "./fields";

/** Zakat fitrah calculator and the reminder notifications before Eid. */
export function ZakatCard({ ctx, locale }: { ctx: RamadhanContext; locale: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const db = useSQLiteContext();
  const { mode, set: setMode } = useStoredMode(db, KEYS.zakatMode);
  const members = useStoredNumber(db, KEYS.zakatMembers, 1);
  const pricePerKg = useStoredNumber(db, KEYS.zakatPrice, null);
  const cash = useStoredNumber(db, KEYS.zakatCash, null);
  const [reminder, setReminder] = useState(false);
  const [denied, setDenied] = useState(false);
  const copy = useMemo(
    () => ({
      title: t("ramadhan.zakat.reminderTitle"),
      body: t("ramadhan.zakat.reminderBody"),
      channelName: t("ramadhan.zakat.reminderChannel"),
    }),
    [t],
  );
  const endKey = `${ctx.span.end.year}-${ctx.span.end.month}-${ctx.span.end.day}`;

  // A stored "on" re-schedules for the Ramadhan being shown, so the reminder carries into next year.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const on = (await getSetting(db, KEYS.zakatReminder)) === "1";
      if (cancelled) return;
      setReminder(on);
      if (on) await scheduleZakatReminders(ctx.span, copy);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
    // `endKey` identifies the span; the span object itself changes identity every render.
  }, [db, endKey, copy]);

  const toggleReminder = async (next: boolean) => {
    setDenied(false);
    if (next) {
      if ((await requestNotificationPermission()) !== "granted") {
        setDenied(true);
        return;
      }
      await scheduleZakatReminders(ctx.span, copy);
    } else {
      await cancelZakatReminders();
    }
    setReminder(next);
    await setSetting(db, KEYS.zakatReminder, next ? "1" : "0");
  };

  const count = members.value;
  const result = useMemo(() => {
    if (count === null || !Number.isInteger(count)) return null;
    const rate: Rate =
      mode === "cash"
        ? { kind: "cash", amount: cash.value ?? 0 }
        : { kind: "rice", pricePerKg: pricePerKg.value ?? undefined };
    return zakatFitrah(count, rate);
  }, [count, mode, cash.value, pricePerKg.value]);

  const priced = ((mode === "cash" ? cash.value : pricePerKg.value) ?? 0) > 0;
  const priceField = mode === "cash" ? cash : pricePerKg;

  return (
    <Section title={t("ramadhan.zakat.title")}>
      <Panel>
        <Hint>{t("ramadhan.zakat.hint")}</Hint>
        <NumberField
          label={t("ramadhan.zakat.members")}
          value={members.value}
          onChangeNumber={members.set}
        />
        <ButtonRow>
          <Button
            tone={mode === "rice" ? "primary" : "plain"}
            label={t("ramadhan.zakat.rice")}
            onPress={() => setMode("rice")}
          />
          <Button
            tone={mode === "cash" ? "primary" : "plain"}
            label={t("ramadhan.zakat.cash")}
            onPress={() => setMode("cash")}
          />
        </ButtonRow>
        <NumberField
          label={t(mode === "rice" ? "ramadhan.zakat.pricePerKg" : "ramadhan.zakat.cashPerPerson")}
          value={priceField.value}
          suffix="Rp"
          onChangeNumber={priceField.set}
        />
        {result ? (
          <View>
            <Heading>
              {result.riceKg !== null
                ? t("ramadhan.zakat.resultRice", {
                    kg: formatNumber(result.riceKg, locale, 3),
                    liters: formatNumber(result.riceLiters ?? 0, locale, 3),
                  })
                : t("ramadhan.zakat.resultCash", {
                    amount: formatRupiah(result.amount ?? 0, locale),
                  })}
            </Heading>
            {result.riceKg !== null && priced && result.amount !== null ? (
              <Text style={{ color: theme.text, fontSize: 16 }}>
                {t("ramadhan.zakat.resultAmount", { amount: formatRupiah(result.amount, locale) })}
              </Text>
            ) : null}
            {mode === "cash" && !priced ? <Hint>{t("ramadhan.zakat.needPrice")}</Hint> : null}
          </View>
        ) : null}
      </Panel>
      <ToggleRow
        label={t("ramadhan.zakat.reminder")}
        hint={t("ramadhan.zakat.reminderHint")}
        value={reminder}
        onValueChange={(v) => void toggleReminder(v)}
      />
      {denied ? (
        <Panel>
          <Hint>{t("ramadhan.zakat.reminderDenied")}</Hint>
        </Panel>
      ) : null}
    </Section>
  );
}
