import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Divider, PressableScale, Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { Segmented } from "@/ibadah/components/Segmented";
import { loadDuas } from "@/ibadah/content";
import { categoryName, duaTitle, searchDuas } from "@/ibadah/labels";
import { useFavourites } from "@/ibadah/useFavourites";
import { hueColors, radius, spacing, typography, useTheme } from "@/theme";

type Filter = "all" | "favourites";

/** Duas by category, with search across every text and a favourites filter. */
export default function DoaListScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const doa = hueColors(theme, "doa");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [favourites] = useFavourites();
  const categories = loadDuas();

  const groups = useMemo(() => {
    const found = searchDuas(categories, query, i18n.language);
    if (filter === "all") return found;
    return found
      .map((group) => ({
        ...group,
        duas: group.duas.filter((dua) => favourites?.has(dua.id) ?? false),
      }))
      .filter((group) => group.duas.length > 0);
  }, [categories, query, filter, favourites, i18n.language]);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={[styles.search, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
      >
        <Ionicons name="search" size={18} color={theme.muted} />
        <TextInput
          accessibilityLabel={t("ibadah.doa.search")}
          placeholder={t("ibadah.doa.searchPlaceholder")}
          placeholderTextColor={theme.faint}
          selectionColor={doa.base}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          style={[typography.body, styles.input, { color: theme.text }]}
        />
      </View>
      <Segmented
        accessibilityLabel={t("ibadah.doa.title")}
        hue="doa"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: t("ibadah.doa.all") },
          {
            value: "favourites",
            label: t("ibadah.doa.favourites"),
            badge: favourites && favourites.size > 0 ? String(favourites.size) : undefined,
          },
        ]}
      />
      {groups.length === 0 ? (
        <Text style={[typography.subhead, styles.empty, { color: theme.muted }]}>
          {filter === "favourites" && query.trim() === ""
            ? t("ibadah.doa.noFavourites")
            : t("ibadah.doa.noResults")}
        </Text>
      ) : (
        groups.map(({ category, duas }) => (
          <Section key={category.id} title={categoryName(category, i18n.language)} hue="doa">
            {duas.map((dua, index) => {
              const title = duaTitle(dua, i18n.language);
              const starred = favourites?.has(dua.id) ?? false;
              return (
                <View key={dua.id}>
                  {index > 0 ? <Divider inset={spacing.md} /> : null}
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={
                      starred ? `${title}, ${t("ibadah.doa.isFavourite")}` : title
                    }
                    onPress={() => router.push({ pathname: "/doa/[id]", params: { id: dua.id } })}
                    scaleTo={0.985}
                    style={styles.row}
                  >
                    <View style={styles.grow}>
                      <Text style={[typography.body, { color: theme.text, fontWeight: "600" }]}>
                        {title}
                      </Text>
                      <Text numberOfLines={1} style={[typography.footnote, { color: theme.muted }]}>
                        {dua.transliteration}
                      </Text>
                      <Text style={[typography.caption, { color: theme.faint }]}>
                        {dua.reference}
                      </Text>
                    </View>
                    {starred ? <Ionicons name="star" size={18} color={doa.base} /> : null}
                    <Ionicons name="chevron-forward" size={18} color={theme.faint} />
                  </PressableScale>
                </View>
              );
            })}
          </Section>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md + 4, paddingTop: spacing.md, gap: spacing.lg },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 46,
    paddingHorizontal: spacing.md - 2,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  input: { flex: 1, paddingVertical: spacing.sm },
  empty: { textAlign: "center", paddingVertical: spacing.lg },
  row: {
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 4,
  },
  grow: { flex: 1, gap: 2 },
});
