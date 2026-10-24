import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Row, Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { Button, Hint, Panel } from "@/ramadhan/components/fields";
import { radius, spacing, useTheme } from "@/theme";

import type { CirclesApi } from "../api";
import { CirclesHttpError } from "../api";
import { circleLanguage, handleProblem, suggestHandle, tzOffsetHours } from "../logic";
import type { Gender } from "../types";

/**
 * First-time setup and the first join in one screen: pick a gender (one tap), then "Join" (second
 * tap). The handle starts as an anonymous suggestion; language and time-zone bucket come from the
 * phone. Nothing here asks for a name, an email or a location.
 */
export function Onboarding({
  api,
  onJoined,
}: {
  api: CirclesApi;
  onJoined: (circleId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const language = circleLanguage(i18n.language);
  const [handle, setHandle] = useState(() => suggestHandle(language));
  const [gender, setGender] = useState<Gender | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problem = handleProblem(handle);
  const ready = gender !== null && problem === null && !busy;

  const submit = async () => {
    if (!gender) return;
    setBusy(true);
    setError(null);
    try {
      await api.saveProfile({
        handle: handle.trim(),
        gender,
        language,
        tzOffsetHours: tzOffsetHours(new Date()),
      });
      const joined = await api.joinPublic();
      onJoined(joined.circle.id);
    } catch (e) {
      setError(t(`circles.errors.${e instanceof CirclesHttpError ? e.key : "generic"}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={[styles.title, { color: theme.text }]}>{t("circles.onboarding.title")}</Text>
      <Text style={{ color: theme.muted }}>{t("circles.onboarding.body")}</Text>

      <Section title={t("circles.onboarding.handle")}>
        <Panel>
          <TextInput
            accessibilityLabel={t("circles.onboarding.handle")}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={24}
            value={handle}
            onChangeText={setHandle}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          {problem ? <Hint>{t(`circles.handleProblem.${problem}`)}</Hint> : null}
          <Button
            tone="plain"
            label={t("circles.onboarding.shuffle")}
            onPress={() => setHandle(suggestHandle(language))}
          />
        </Panel>
      </Section>

      <Section title={t("circles.onboarding.gender")}>
        <Row
          label={t("circles.onboarding.ikhwan")}
          selected={gender === "ikhwan"}
          onPress={() => setGender("ikhwan")}
        />
        <Row
          label={t("circles.onboarding.akhwat")}
          selected={gender === "akhwat"}
          onPress={() => setGender("akhwat")}
        />
        <Panel>
          <Hint>{t("circles.onboarding.genderHint")}</Hint>
        </Panel>
      </Section>

      {error ? <Text style={{ color: theme.text }}>{error}</Text> : null}
      <Button
        label={busy ? t("circles.loading") : t("circles.onboarding.join")}
        onPress={() => void submit()}
        disabled={!ready}
      />
      <Hint>{t("circles.onboarding.privacy")}</Hint>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  title: { fontSize: 22, fontWeight: "700" },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
});
