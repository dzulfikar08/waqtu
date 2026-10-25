import { ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const insets = useSafeAreaInsets();
  const model = useHafalan();
  if (!model) return null;
  const { data } = model;
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
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

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md + 4, paddingTop: spacing.sm, gap: spacing.lg },
});
