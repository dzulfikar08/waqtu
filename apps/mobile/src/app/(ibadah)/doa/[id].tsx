import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { ArabicText } from "@/ibadah/components/ArabicText";
import { DUA_TRANSLATION_LANG, findDua } from "@/ibadah/content";
import { categoryName, duaTitle } from "@/ibadah/labels";
import { useFavourites } from "@/ibadah/useFavourites";
import { Button } from "@/ramadhan/components/fields";
import { hueColors, spacing, typography, useTheme } from "@/theme";

/** One dua: Arabic, transliteration, translation (in the source's language), its source, and the favourite toggle. */
export default function DoaScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [favourites, toggle] = useFavourites();
  const found = typeof id === "string" ? findDua(id) : null;
  const doa = hueColors(theme, "doa");

  if (!found) {
    return (
      <View style={[styles.content, { backgroundColor: theme.background, flex: 1 }]}>
        <Text style={[typography.body, { color: theme.muted }]}>{t("ibadah.doa.notFound")}</Text>
      </View>
    );
  }
  const { dua, category } = found;
  const title = duaTitle(dua, i18n.language);
  const starred = favourites?.has(dua.id) ?? false;
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
    >
      <Stack.Screen options={{ title }} />
      <View style={styles.head}>
        <Text style={[typography.overline, { color: doa.base }]}>
          {categoryName(category, i18n.language)}
        </Text>
        <Text accessibilityRole="header" style={[typography.title, { color: theme.text }]}>
          {title}
        </Text>
      </View>
      <Card hue="doa">
        <ArabicText size={30}>{dua.arabic}</ArabicText>
      </Card>
      <Card>
        <Text style={[typography.overline, { color: theme.muted }]}>
          {t("ibadah.doa.transliteration")}
        </Text>
        <Text style={[typography.body, styles.latin, { color: doa.base }]}>
          {dua.transliteration}
        </Text>
        <Text style={[typography.overline, styles.label, { color: theme.muted }]}>
          {t("ibadah.doa.translation")}
        </Text>
        <Text style={[typography.body, styles.body, { color: theme.text }]}>{dua.translation}</Text>
        {DUA_TRANSLATION_LANG !== i18n.language ? (
          <Text style={[typography.caption, { color: theme.faint }]}>
            {t("ibadah.doa.translationEn")}
          </Text>
        ) : null}
        {dua.notes ? (
          <>
            <Text style={[typography.overline, styles.label, { color: theme.muted }]}>
              {t("ibadah.doa.notes")}
            </Text>
            <Text style={[typography.subhead, styles.body, { color: theme.text }]}>
              {dua.notes}
            </Text>
          </>
        ) : null}
        <Text style={[typography.overline, styles.label, { color: theme.muted }]}>
          {t("ibadah.doa.source")}
        </Text>
        <Text style={[typography.subhead, { color: theme.text }]}>{dua.reference}</Text>
      </Card>
      <Button
        label={starred ? t("ibadah.doa.unfavourite") : t("ibadah.doa.favourite")}
        icon={starred ? "star" : "star-outline"}
        tone={starred ? "plain" : "primary"}
        block
        disabled={!favourites}
        onPress={() => toggle(dua.id)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md + 4, paddingTop: spacing.md, gap: spacing.md },
  head: { gap: 2, paddingHorizontal: spacing.xs },
  latin: { fontStyle: "italic", lineHeight: 23 },
  body: { lineHeight: 23 },
  label: { marginTop: spacing.sm },
});
