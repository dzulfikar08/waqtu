import { firstLetters, surahInfo } from "@waqtu/core";
import { Fragment } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTranslation } from "@/i18n";
import { arabicDigits } from "../format";
import { wordKey, type UnitBlock } from "../text";
import { radius, spacing, useTheme } from "@/theme";

export type TestMode = "show" | "hide" | "letters";

/**
 * A unit of the mushaf in Uthmani script, right to left. In `hide` and `letters` mode every word
 * that is not in `revealed` is covered (or shown by its first letters); tapping a word reveals it.
 */
export function UnitText({
  blocks,
  mode,
  revealed,
  onReveal,
  fontFamily,
  fontSize,
}: {
  blocks: readonly UnitBlock[];
  mode: TestMode;
  revealed: ReadonlySet<string>;
  onReveal: (key: string) => void;
  fontFamily: string | undefined;
  fontSize: number;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const quran = {
    fontFamily,
    fontSize,
    lineHeight: Math.round(fontSize * 1.9),
    color: theme.text,
    writingDirection: "rtl" as const,
  };
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {blocks.map((block) => (
        <View key={`${block.surah}:${block.ayahs[0].ayah}`} style={styles.block}>
          {block.startsSurah ? (
            <View style={[styles.surah, { borderColor: theme.border }]}>
              <Text style={[styles.surahArabic, { color: theme.accent, fontFamily }]}>
                {surahInfo(block.surah).arabic}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 13 }}>
                {t("hafalan.surahLabel", {
                  name:
                    i18n.language === "en"
                      ? `${surahInfo(block.surah).id} (${surahInfo(block.surah).en})`
                      : surahInfo(block.surah).id,
                })}
              </Text>
            </View>
          ) : null}
          {block.bismillah !== null ? (
            <Text style={[quran, styles.bismillah]}>{block.bismillah}</Text>
          ) : null}
          <Text style={[quran, styles.verses]}>
            {block.ayahs.map((ayah) => (
              <Fragment key={ayah.index}>
                {ayah.words.map((word, i) => {
                  const key = wordKey(ayah.index, i);
                  const open = mode === "show" || revealed.has(key);
                  const space = i < ayah.words.length - 1 ? " " : "";
                  return (
                    <Fragment key={key}>
                      <Text
                        onPress={open ? undefined : () => onReveal(key)}
                        accessibilityRole={open ? undefined : "button"}
                        accessibilityLabel={open ? undefined : t("hafalan.hiddenWord")}
                        style={open ? undefined : { backgroundColor: theme.border }}
                      >
                        {open ? word : mode === "letters" ? `${firstLetters(word)}…` : maskOf(word)}
                      </Text>
                      {space}
                    </Fragment>
                  );
                })}
                {` \uFD3F${arabicDigits(ayah.ayah)}\uFD3E `}
              </Fragment>
            ))}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A covered word keeps its length as non-breaking blanks, so the line breaks fall where they would. */
function maskOf(word: string): string {
  return "\u00A0".repeat(Math.max(2, Math.min(10, Math.round(word.length / 2))));
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md },
  block: { gap: spacing.sm },
  surah: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.sm,
    marginBottom: spacing.xs,
  },
  surahArabic: { fontSize: 28 },
  bismillah: { textAlign: "center" },
  verses: { textAlign: "right" },
});
