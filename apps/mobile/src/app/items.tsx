import { Ionicons } from "@expo/vector-icons";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { itemLabel } from "@/components/itemLabel";
import { IconChip, Pill, Row, Section, type IconName } from "@/components/ui";
import { getSetting, setSyncedSetting } from "@/db/settings";
import { useTranslation } from "@/i18n";
import { Button } from "@/ramadhan/components/fields";
import {
  MAX_LABEL,
  addBuiltinItem,
  addCustomItem,
  missingBuiltins,
  parseItems,
  removeItem,
  serializeItems,
  type ItemDef,
  type ItemKind,
} from "@/mutabaah/items";
import { ITEMS_KEY } from "@/mutabaah/syncKeys";
import { HIT, radius, spacing, typography, useTheme } from "@/theme";

/** The glyph of each kind of item: a prayer, a done/not-done habit, a counted one. */
const KIND_ICON: Record<ItemKind, IconName> = {
  fardh: "time-outline",
  check: "checkmark-done",
  count: "repeat",
};

function token(): string {
  return Math.random().toString(36).slice(2, 12).padEnd(10, "0");
}

export default function ItemsScreen() {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ItemDef[] | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Exclude<ItemKind, "fardh">>("check");

  useEffect(() => {
    void getSetting(db, ITEMS_KEY).then((raw) => setItems(parseItems(raw)));
  }, [db]);

  if (!items) return null;

  const save = (next: ItemDef[]) => {
    setItems(next);
    void setSyncedSetting(db, ITEMS_KEY, serializeItems(next));
  };

  const addCustom = () => {
    const next = addCustomItem(items, name, kind, token);
    if (next.length === items.length) return;
    save(next);
    setName("");
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={18} color={theme.muted} />
        <Text style={[typography.footnote, styles.grow, { color: theme.muted }]}>
          {t("items.fardhNote")}
        </Text>
      </View>
      <Section title={t("items.active")} icon="list" hue="brand">
        {items.map((item) => {
          const label = itemLabel(item, t);
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={t("items.remove", { name: label })}
              onPress={() => save(removeItem(items, item.id))}
              style={({ pressed }) => [
                styles.line,
                {
                  borderColor: theme.separator,
                  backgroundColor: pressed ? theme.surfaceAlt : "transparent",
                },
              ]}
            >
              <IconChip icon={KIND_ICON[item.kind]} size={30} />
              <Text style={[typography.body, styles.grow, { color: theme.text }]}>{label}</Text>
              <Ionicons name="remove-circle" size={24} color={theme.danger} />
            </Pressable>
          );
        })}
      </Section>

      {missingBuiltins(items).length > 0 ? (
        <Section title={t("items.available")} icon="add-circle" hue="brand">
          {missingBuiltins(items).map((item) => {
            const label = itemLabel(item, t);
            return (
              <Row
                key={item.id}
                label={`+ ${label}`}
                icon={KIND_ICON[item.kind]}
                onPress={() => save(addBuiltinItem(items, item.id))}
              />
            );
          })}
        </Section>
      ) : null}

      <Section title={t("items.custom")} icon="create" hue="neutral">
        <View style={styles.form}>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={MAX_LABEL}
            placeholder={t("items.namePlaceholder")}
            placeholderTextColor={theme.faint}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceAlt },
            ]}
            returnKeyType="done"
            onSubmitEditing={addCustom}
          />
          <View style={styles.kinds}>
            <Pill
              label={t("items.kindCheck")}
              on={kind === "check"}
              onPress={() => setKind("check")}
            />
            <Pill
              label={t("items.kindCount")}
              on={kind === "count"}
              onPress={() => setKind("count")}
            />
          </View>
          <Button
            block
            label={t("items.add")}
            icon="add"
            disabled={name.trim().length === 0}
            onPress={addCustom}
          />
        </View>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md + 4, paddingTop: spacing.md, gap: spacing.lg },
  note: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingHorizontal: 4 },
  grow: { flex: 1 },
  line: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  form: { padding: spacing.md, gap: spacing.md - 4 },
  input: {
    minHeight: HIT + 4,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  kinds: { flexDirection: "row", gap: spacing.sm },
});
