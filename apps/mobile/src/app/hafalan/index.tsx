import { ScrollView, StyleSheet } from "react-native";

import { PlanForm } from "@/hafalan/components/PlanForm";
import { PlanOverview } from "@/hafalan/components/PlanOverview";
import { PlanSettings } from "@/hafalan/components/PlanSettings";
import { TodayLists } from "@/hafalan/components/TodayLists";
import { QuranCredit } from "@/hafalan/components/QuranCredit";
import { useHafalan } from "@/hafalan/useHafalan";
import { spacing, useTheme } from "@/theme";

/** Plan creation when there is none; otherwise the plan, today's new portion and murojaah, and plan settings. */
export default function HafalanScreen() {
  const theme = useTheme();
  const model = useHafalan();
  if (!model) return null;
  const { data } = model;
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {data ? (
        <>
          <PlanOverview data={data} />
          <TodayLists data={data} />
          <PlanSettings data={data} />
        </>
      ) : (
        <PlanForm today={model.today} />
      )}
      <QuranCredit />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: spacing.md, gap: spacing.lg } });
