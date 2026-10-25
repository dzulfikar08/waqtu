import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { CheckCircle, IconChip, Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { Hint } from "@/ramadhan/components/fields";
import { hueColors, radius, spacing, tabular, typography, useTheme, type Hue } from "@/theme";
import { unitLabel } from "../format";
import type { HafalanData } from "../useHafalan";

/** Today's new portion and murojaah as tappable rows; finished ones carry a check. */
export function TodayLists({ data }: { data: HafalanData }) {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const { portion, units, states } = data;
  const dueBefore = (unit: number) => {
    const due = states.find((s) => s.unit === unit)?.due;
    return due !== null && due !== undefined && due < portion.day;
  };
  const open = (unit: number) =>
    router.push({ pathname: "/hafalan/[unit]", params: { unit: String(unit) } });

  const sabaq = [...portion.sabaq.done, ...portion.sabaq.todo];
  const murojaah = [...portion.murojaah.done, ...portion.murojaah.todo];
  const none = (
    <View style={styles.none}>
      <Ionicons name="leaf-outline" size={18} color={theme.faint} />
      <Text style={[typography.callout, { color: theme.muted }]}>{t("hafalan.noneToday")}</Text>
    </View>
  );
  return (
    <>
      <Section
        title={t("hafalan.sabaq")}
        icon="book-outline"
        hue="hafalan"
        right={<Count hue="hafalan" done={portion.sabaq.done.length} total={sabaq.length} />}
      >
        {sabaq.length === 0
          ? none
          : sabaq.map((unit) => (
              <UnitRow
                hue="hafalan"
                key={unit}
                label={unitLabel(units[unit])}
                detail={t("hafalan.page", { page: units[unit].page })}
                done={portion.sabaq.done.includes(unit)}
                onPress={() => open(unit)}
              />
            ))}
      </Section>
      <Section
        title={t("hafalan.murojaah")}
        icon="repeat"
        hue="week"
        right={<Count hue="week" done={portion.murojaah.done.length} total={murojaah.length} />}
      >
        {murojaah.length === 0
          ? none
          : murojaah.map((unit) => (
              <UnitRow
                hue="week"
                key={unit}
                label={unitLabel(units[unit])}
                detail={t("hafalan.page", { page: units[unit].page })}
                flag={dueBefore(unit) ? t("hafalan.overdue") : undefined}
                done={portion.murojaah.done.includes(unit)}
                onPress={() => open(unit)}
              />
            ))}
      </Section>
      {portion.murojaah.deferred > 0 ? (
        <View style={styles.note}>
          <Hint>{t("hafalan.deferred", { count: portion.murojaah.deferred })}</Hint>
        </View>
      ) : null}
      {portion.complete ? (
        <View style={[styles.banner, { backgroundColor: theme.accentSoft }]}>
          <IconChip icon="checkmark-done" color={theme.accentText} background={theme.accent} />
          <Text
            style={[typography.callout, styles.grow, { color: theme.accent, fontWeight: "600" }]}
          >
            {t("hafalan.dayComplete")}
          </Text>
        </View>
      ) : null}
    </>
  );
}

/** `2/3` beside a section title: how much of the list is done. */
function Count({ done, total, hue }: { done: number; total: number; hue: Hue }) {
  const theme = useTheme();
  if (total === 0) return null;
  return (
    <Text
      style={[typography.footnote, tabular, styles.count, { color: hueColors(theme, hue).base }]}
    >
      {done}/{total}
    </Text>
  );
}

/** One unit of today's list: a check ring (filled once graded today), the unit and its page. */
function UnitRow({
  label,
  detail,
  flag,
  done,
  hue,
  onPress,
}: {
  label: string;
  detail: string;
  /** Short warning after the page, e.g. overdue. */
  flag?: string;
  done: boolean;
  /** The list's colour, for the pressed wash and the chevron. */
  hue: Hue;
  onPress: () => void;
}) {
  const theme = useTheme();
  const tone = hueColors(theme, hue);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: done }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: theme.separator,
          backgroundColor: pressed ? tone.soft : "transparent",
        },
      ]}
    >
      <CheckCircle checked={done} />
      <View style={styles.grow}>
        <Text
          style={[
            typography.body,
            { color: done ? theme.muted : theme.text, fontWeight: done ? "400" : "600" },
          ]}
        >
          {label}
        </Text>
        <Text style={[typography.footnote, { color: theme.muted }]}>
          {detail}
          {flag ? (
            <Text style={{ color: theme.warning, fontWeight: "600" }}>{` · ${flag}`}</Text>
          ) : null}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={tone.base} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  none: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  count: { fontWeight: "700" },
  row: {
    minHeight: 60,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  grow: { flex: 1, gap: 2 },
  note: { paddingHorizontal: spacing.xs, marginTop: -spacing.sm },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 4,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
});
