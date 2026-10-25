import { useRouter } from "expo-router";

import { Row, Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { useHafalan } from "../useHafalan";
import { targetLabel } from "./PlanOverview";

/**
 * Today-tab entry to hafalan: a summary of today's list when a plan exists, otherwise a row
 * that leads to creating one.
 */
export function HafalanCard() {
  const router = useRouter();
  const { t } = useTranslation();
  const model = useHafalan();
  if (!model) return null;
  const open = () => router.push("/hafalan");
  const { data } = model;
  if (!data) {
    return (
      <Section title={t("hafalan.todayRowTitle")} icon="book-outline" hue="hafalan">
        <Row icon="book" hue="hafalan" label={t("hafalan.todayRowBody")} onPress={open} chevron />
      </Section>
    );
  }
  const { portion } = data;
  const todo = portion.sabaq.todo.length + portion.murojaah.todo.length;
  const line =
    portion.phase === "upcoming"
      ? t("hafalan.cardUpcoming", { day: data.plan.startDay })
      : portion.complete
        ? t("hafalan.cardDone")
        : todo === 0
          ? t("hafalan.cardIdle")
          : t("hafalan.cardLine", {
              sabaq: portion.sabaq.todo.length,
              murojaah: portion.murojaah.todo.length,
            });
  return (
    <Section
      title={`${t("hafalan.cardTitle")} · ${targetLabel(data.plan.target, t)}`}
      icon="book-outline" hue="hafalan"
    >
      <Row icon="book" hue="hafalan" label={line} selected={portion.complete} onPress={open} chevron />
    </Section>
  );
}
