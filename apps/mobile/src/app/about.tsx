import Constants from "expo-constants";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { Row, Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { Panel, ToggleRow } from "@/ramadhan/components/fields";
import { DEV_MENU_TAPS } from "@/recitation/dev";
import { useRecitationDev } from "@/recitation/useDevSettings";
import { spacing, useTheme } from "@/theme";

const APACHE_2 = "https://www.apache.org/licenses/LICENSE-2.0";

/**
 * Version and third-party licences (the Apache-2.0 notice of the recitation models among them).
 * Tapping the version line `DEV_MENU_TAPS` times shows the developer section; development builds
 * always show it.
 */
export default function AboutScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const dev = useRecitationDev();
  const [taps, setTaps] = useState(0);
  const showDeveloper = __DEV__ || taps >= DEV_MENU_TAPS;
  const version = Constants.expoConfig?.version ?? "?";

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      <Section title={t("about.title")}>
        <Pressable onPress={() => setTaps((n) => n + 1)} style={styles.version}>
          <Text style={{ color: theme.text, fontSize: 16 }}>{t("about.version", { version })}</Text>
          {taps >= DEV_MENU_TAPS ? (
            <Text style={{ color: theme.muted }}>{t("about.devUnlocked")}</Text>
          ) : null}
        </Pressable>
      </Section>
      <Section title={t("about.licences")}>
        <Panel>
          <Text style={[styles.body, { color: theme.text }]}>{t("about.quran")}</Text>
          <Text style={[styles.body, { color: theme.text }]}>{t("about.font")}</Text>
          <Text style={[styles.body, { color: theme.text }]}>{t("about.models")}</Text>
          <Text style={[styles.body, { color: theme.text }]}>{t("about.runtime")}</Text>
        </Panel>
        <Row label={t("about.apache")} onPress={() => void Linking.openURL(APACHE_2)} />
      </Section>
      {showDeveloper ? (
        <Section title={t("about.developer")}>
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
  content: { padding: spacing.md, gap: spacing.lg },
  version: { minHeight: 48, padding: spacing.md, gap: spacing.xs, justifyContent: "center" },
  body: { fontSize: 14, lineHeight: 20 },
});
