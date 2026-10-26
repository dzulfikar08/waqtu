import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";

import { useMutabaah } from "@/hooks/useMutabaah";
import { useTranslation } from "@/i18n";
import { Reader } from "@/ibadah/components/Reader";
import { Segmented } from "@/ibadah/components/Segmented";
import { loadSession, matsuratSession, type MatsuratKind, type ReaderTime } from "@/ibadah/content";
import { suggestTimeAt } from "@/ibadah/suggest";

/** Al-Ma'tsurat, kubro or sughro, morning or evening; opens on the part of the day it is now. */
export default function MatsuratScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ kind?: string; time?: string }>();
  const model = useMutabaah();
  const [kind, setKind] = useState<MatsuratKind>(params.kind === "kubro" ? "kubro" : "sughro");
  const [chosen, setChosen] = useState<ReaderTime | null>(
    params.time === "pagi" || params.time === "petang" ? params.time : null,
  );
  const suggested = model ? suggestTimeAt(model.settings, new Date()) : null;
  const time = chosen ?? suggested;
  const session = useMemo(
    () => (time ? loadSession(matsuratSession(kind, time)) : null),
    [kind, time],
  );
  if (!time || !session || !suggested) return null;

  return (
    <Reader
      key={session.id}
      session={session}
      time={time}
      hue="matsurat"
      header={
        <>
          <Segmented
            accessibilityLabel={t("ibadah.reader.timeChoice")}
            hue="matsurat"
            value={time}
            onChange={setChosen}
            options={(["pagi", "petang"] as const).map((value) => ({
              value,
              label: t(`ibadah.timeTitle.${value}`),
              badge: value === suggested ? t("ibadah.reader.now") : undefined,
            }))}
          />
          <Segmented
            accessibilityLabel={t("ibadah.reader.kindChoice")}
            hue="matsurat"
            value={kind}
            onChange={setKind}
            options={[
              { value: "sughro", label: t("ibadah.matsurat.sughro") },
              { value: "kubro", label: t("ibadah.matsurat.kubro") },
            ]}
          />
        </>
      }
    />
  );
}
