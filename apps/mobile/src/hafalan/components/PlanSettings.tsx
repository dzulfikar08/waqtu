import { addIsoDays } from "@waqtu/core";
import { useSQLiteContext } from "expo-sqlite";
import { Alert } from "react-native";

import { Section, StepperRow } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { Button, Panel } from "@/ramadhan/components/fields";
import { deletePlan, MAX_REVIEW_PER_DAY, MIN_REVIEW_PER_DAY, updatePlan } from "../db";
import { removeRecordings } from "../recordings";
import type { HafalanData } from "../useHafalan";

/** Moving the deadline, the daily review cap, and deleting the plan. */
export function PlanSettings({ data }: { data: HafalanData }) {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const { plan, today } = data;

  const confirmDelete = () =>
    Alert.alert(t("hafalan.deleteTitle"), t("hafalan.deleteBody"), [
      { text: t("hafalan.cancel"), style: "cancel" },
      {
        text: t("hafalan.confirmDelete"),
        style: "destructive",
        onPress: () => void deletePlan(db).then(removeRecordings),
      },
    ]);

  return (
    <Section title={t("hafalan.planTitle")}>
      <StepperRow
        label={t("hafalan.reviewCap")}
        value={plan.maxReviewPerDay}
        min={MIN_REVIEW_PER_DAY}
        max={MAX_REVIEW_PER_DAY}
        onChange={(next) => void updatePlan(db, { maxReviewPerDay: next })}
      />
      <Panel>
        <Button
          tone="plain"
          label={t("hafalan.extend")}
          onPress={() =>
            void updatePlan(db, {
              deadline: addIsoDays(plan.deadline < today ? today : plan.deadline, 7),
            })
          }
        />
        <Button tone="plain" label={t("hafalan.deletePlan")} onPress={confirmDelete} />
      </Panel>
    </Section>
  );
}
