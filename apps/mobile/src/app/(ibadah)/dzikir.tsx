import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";

import { useMutabaah } from "@/hooks/useMutabaah";
import { useTranslation } from "@/i18n";
import { Reader } from "@/ibadah/components/Reader";
import { Segmented } from "@/ibadah/components/Segmented";
import { dzikirSession, loadSession, type ReaderTime } from "@/ibadah/content";
import { suggestTimeAt } from "@/ibadah/suggest";

/** Morning or evening dhikr; opens on `time` (from a checklist row) or on the part of the day it is now. */
export default function DzikirScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ time?: string }>();
  const model = useMutabaah();
  const [chosen, setChosen] = useState<ReaderTime | null>(
    params.time === "pagi" || params.time === "petang" ? params.time : null,
  );
  const suggested = model ? suggestTimeAt(model.settings, new Date()) : null;
  const time = chosen ?? suggested;
  const session = useMemo(() => (time ? loadSession(dzikirSession(time)) : null), [time]);
  if (!time || !session || !suggested) return null;

  return (
    <Reader
      key={session.id}
      session={session}
      time={time}
      hue="dzikir"
      header={
        <Segmented
          accessibilityLabel={t("ibadah.reader.timeChoice")}
          hue="dzikir"
          value={time}
          onChange={setChosen}
          options={(["pagi", "petang"] as const).map((value) => ({
            value,
            label: t(`ibadah.timeTitle.${value}`),
            badge: value === suggested ? t("ibadah.reader.now") : undefined,
          }))}
        />
      }
    />
  );
}
