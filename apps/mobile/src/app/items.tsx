import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { itemLabel } from "@/components/itemLabel";
import { Row, Section } from "@/components/ui";
import { getSetting, setSyncedSetting } from "@/db/settings";
import { useTranslation } from "@/i18n";
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
import { radius, spacing, useTheme } from "@/theme";

function token(): string {
  return Math.random().toString(36).slice(2, 12).padEnd(10, "0");
}

export default function ItemsScreen() {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const theme = useTheme();
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
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ color: theme.muted }}>{t("items.fardhNote")}</Text>
      <Section title={t("items.active")}>
        {items.map((item) => {
          const label = itemLabel(item, t);
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={t("items.remove", { name: label })}
              onPress={() => save(removeItem(items, item.id))}
              style={[styles.line, { borderColor: theme.border }]}
            >
              <Text style={{ color: theme.text, fontSize: 16, flexShrink: 1 }}>{label}</Text>
              <Text style={{ color: theme.muted, fontSize: 20 }}>−</Text>
            </Pressable>
          );
        })}
      </Section>

      {missingBuiltins(items).length > 0 ? (
        <Section title={t("items.available")}>
          {missingBuiltins(items).map((item) => {
            const label = itemLabel(item, t);
            return (
              <Row
                key={item.id}
                label={`+ ${label}`}
                onPress={() => save(addBuiltinItem(items, item.id))}
              />
            );
          })}
        </Section>
      ) : null}

      <Section title={t("items.custom")}>
        <View style={styles.form}>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={MAX_LABEL}
            placeholder={t("items.namePlaceholder")}
            placeholderTextColor={theme.muted}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            returnKeyType="done"
            onSubmitEditing={addCustom}
          />
          <View style={styles.kinds}>
            <Kind
              label={t("items.kindCheck")}
              on={kind === "check"}
              onPress={() => setKind("check")}
            />
            <Kind
              label={t("items.kindCount")}
              on={kind === "count"}
              onPress={() => setKind("count")}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={name.trim().length === 0}
            onPress={addCustom}
            style={[
              styles.add,
              { backgroundColor: theme.accent, opacity: name.trim().length === 0 ? 0.4 : 1 },
            ]}
          >
            <Text style={{ color: theme.accentText, fontWeight: "600" }}>{t("items.add")}</Text>
          </Pressable>
        </View>
      </Section>
    </ScrollView>
  );
}

function Kind({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[
        styles.kind,
        {
          borderColor: on ? theme.accent : theme.border,
          backgroundColor: on ? theme.accent : "transparent",
        },
      ]}
    >
      <Text style={{ color: on ? theme.accentText : theme.text, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.lg },
  line: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  form: { padding: spacing.md, gap: spacing.sm },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  kinds: { flexDirection: "row", gap: spacing.sm },
  kind: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: "center",
  },
  add: { minHeight: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
});
