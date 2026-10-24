import { useRouter } from "expo-router";

import { Row, Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { useHalaqahToday } from "../useHalaqah";

/** Today-tab shortcut to the halaqah screen; only shown during Ramadhan. */
export function HalaqahTodayRow() {
  const router = useRouter();
  const { t } = useTranslation();
  const today = useHalaqahToday();
  if (today?.position.kind !== "during") return null;
  return (
    <Section title={t("halaqah.title")}>
      <Row
        label={`${t("halaqah.todayTitle")} · ${t("halaqah.dayN", { day: today.position.day })}`}
        onPress={() => router.push("/halaqah")}
      />
    </Section>
  );
}
