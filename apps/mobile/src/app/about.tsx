import Constants from "expo-constants";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconChip, Row, Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { Panel, ToggleRow } from "@/ramadhan/components/fields";
import { DEV_MENU_TAPS } from "@/recitation/dev";
import { useRecitationDev } from "@/recitation/useDevSettings";
import { spacing, tabular, typography, useTheme } from "@/theme";

const APACHE_2 = "https://www.apache.org/licenses/LICENSE-2.0";

/**
 * Version and third-party licences (the Apache-2.0 notice of the recitation models among them).
 * Tapping the version line `DEV_MENU_TAPS` times shows the developer section; development builds
 * always show it.
 */
export default function AboutScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const dev = useRecitationDev();
  const [taps, setTaps] = useState(0);
  const showDeveloper = __DEV__ || taps >= DEV_MENU_TAPS;
  const version = Constants.expoConfig?.version ?? "?";

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
    >
      <Section title={t("about.title")} icon="information-circle" hue="brand">
        <Pressable
          onPress={() => setTaps((n) => n + 1)}
          style={({ pressed }) => [
            styles.version,
            { backgroundColor: pressed ? theme.surfaceAlt : "transparent" },
          ]}
        >
          <IconChip icon="phone-portrait" size={40} />
          <View style={styles.versionText}>
            <Text style={[typography.headline, tabular, { color: theme.text }]}>
              {t("about.version", { version })}
            </Text>
            {taps >= DEV_MENU_TAPS ? (
              <Text style={[typography.footnote, { color: theme.muted }]}>
                {t("about.devUnlocked")}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Section>
      <Section title={t("about.licences")} icon="document-text" hue="neutral">
        <Panel>
          <Text style={[styles.body, { color: theme.text }]}>{t("about.quran")}</Text>
          <Text style={[styles.body, { color: theme.text }]}>{t("about.font")}</Text>
          <Text style={[styles.body, { color: theme.text }]}>{t("about.adhkar")}</Text>
          <Text style={[styles.body, { color: theme.text }]}>{t("about.models")}</Text>
          <Text style={[styles.body, { color: theme.text }]}>{t("about.runtime")}</Text>
        </Panel>
        <View style={[styles.separator, { backgroundColor: theme.separator }]} />
        <Row
          label={t("about.apache")}
          icon="open-outline"
          hue="neutral"
          chevron
          onPress={() => void Linking.openURL(APACHE_2)}
        />
      </Section>
      {showDeveloper ? (
        <Section title={t("about.developer")} icon="construct" hue="neutral">
          <ToggleRow
            label={t("about.recitationCheck")}
            hint={t("about.recitationCheckHint")}
            value={dev.enabled}
            disabled={!dev.loaded}
            onValueChange={(on) => void dev.setEnabled(on)}
          />
        </Section>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md + 4, paddingTop: spacing.md, gap: spacing.lg },
  version: {
    minHeight: 64,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 4,
  },
  versionText: { flex: 1, gap: 2 },
  body: { ...typography.subhead, lineHeight: 20 },
  separator: { height: StyleSheet.hairlineWidth },
});
