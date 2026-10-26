import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/ui";
import { useMutabaah } from "@/hooks/useMutabaah";
import { useTranslation } from "@/i18n";
import { RatingPicker, formatDay } from "@/ibadah/components/Muhasabah";
import {
  MAX_TEXT,
  QUESTIONS,
  deleteMuhasabah,
  emptyEntry,
  getMuhasabah,
  hasContent,
  saveMuhasabah,
  type MuhasabahEntry,
} from "@/ibadah/muhasabah";
import { isDayKey } from "@/mutabaah/dates";
import { Button } from "@/ramadhan/components/fields";
import { hueColors, radius, spacing, typography, useTheme } from "@/theme";

/** One day's muhasabah: the seven questions in order on one page, saved to this phone only. */
export default function MuhasabahEntryScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const model = useMutabaah();
  const { date } = useLocalSearchParams<{ date: string }>();
  const valid = typeof date === "string" && isDayKey(date);
  const [entry, setEntry] = useState<MuhasabahEntry | null>(null);
  const [stored, setStored] = useState(false);
  const [saving, setSaving] = useState(false);
  const colors = hueColors(theme, "muhasabah");

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    void getMuhasabah(db, date).then((found) => {
      if (cancelled) return;
      setEntry(found ?? emptyEntry(date));
      setStored(found !== null);
    });
    return () => {
      cancelled = true;
    };
  }, [db, date, valid]);

  const today = model?.today;
  if (!valid || !today) return null;
  const title = t("ibadah.muhasabah.entryTitle", { day: formatDay(date, i18n.language) });
  if (date > today) {
    return (
      <View style={[styles.content, { flex: 1, backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title }} />
        <Text style={[typography.body, { color: theme.muted }]}>{t("ibadah.muhasabah.future")}</Text>
      </View>
    );
  }
  if (!entry) return null;

  const save = async () => {
    setSaving(true);
    try {
      await saveMuhasabah(db, entry);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert(t("ibadah.muhasabah.deleteTitle"), t("ibadah.muhasabah.deleteBody"), [
      { text: t("ibadah.muhasabah.cancel"), style: "cancel" },
      {
        text: t("ibadah.muhasabah.confirmDelete"),
        style: "destructive",
        onPress: () => void deleteMuhasabah(db, date).then(() => router.back()),
      },
    ]);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      <Stack.Screen options={{ title }} />
      <Text style={[typography.footnote, { color: theme.muted }]}>
        {t("ibadah.muhasabah.private")}
      </Text>
      {QUESTIONS.map((question, index) => (
        <Card key={question.id} hue="muhasabah">
          <Text style={[typography.overline, { color: colors.base }]}>
            {index + 1} / {QUESTIONS.length}
          </Text>
          <Text style={[typography.headline, { color: theme.text }]}>
            {t(`ibadah.muhasabah.question.${question.id}`)}
          </Text>
          {question.kind === "text" ? (
            <TextInput
              accessibilityLabel={t(`ibadah.muhasabah.question.${question.id}`)}
              placeholder={t(`ibadah.muhasabah.placeholder.${question.id}`)}
              placeholderTextColor={theme.faint}
              selectionColor={colors.base}
              multiline
              maxLength={MAX_TEXT}
              value={entry[question.id] ?? ""}
              onChangeText={(text) => setEntry({ ...entry, [question.id]: text })}
              style={[
                typography.body,
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.surfaceAlt,
                  borderColor: theme.border,
                },
              ]}
            />
          ) : (
            <RatingPicker
              aspect={question.id}
              value={entry[question.id]}
              onChange={(value) => setEntry({ ...entry, [question.id]: value })}
            />
          )}
        </Card>
      ))}
      <Button
        label={t("ibadah.muhasabah.save")}
        icon="checkmark"
        block
        disabled={saving || (!stored && !hasContent(entry))}
        onPress={() => void save()}
      />
      {stored ? (
        <Button
          label={t("ibadah.muhasabah.delete")}
          icon="trash-outline"
          tone="plain"
          block
          onPress={remove}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md + 4, paddingTop: spacing.md, gap: spacing.md },
  input: {
    minHeight: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md - 2,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
    textAlignVertical: "top",
  },
});
