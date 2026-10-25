import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Row, Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { Button, Hint, Panel } from "@/ramadhan/components/fields";
import { radius, spacing, useTheme } from "@/theme";

import type { CirclesApi } from "../api";
import { CirclesHttpError } from "../api";
import {
  circleLanguage,
  handleProblem,
  isInviteCode,
  saveWithFreshHandle,
  suggestHandle,
  tzOffsetHours,
} from "../logic";
import type { Gender } from "../types";

/**
 * First-time setup and the first join in one screen: pick a gender (one tap), then "Join" (second
 * tap). The handle starts as an anonymous suggestion; language and time-zone bucket come from the
 * phone. Nothing here asks for a name, an email or a location. An optional invite code joins that
 * private circle instead of a public one.
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
  /** False once the user types their own handle; only our suggestions are retried silently. */
  const [suggested, setSuggested] = useState(true);
  const [gender, setGender] = useState<Gender | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problem = handleProblem(handle);
  const codeOk = code.trim() === "" || isInviteCode(code);
  const ready = gender !== null && problem === null && codeOk && !busy;

  const submit = async () => {
    if (!gender) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await saveWithFreshHandle({
        handle: handle.trim(),
        suggested,
        save: (next) =>
          api.saveProfile({
            handle: next,
            gender,
            language,
            tzOffsetHours: tzOffsetHours(new Date()),
          }),
        suggest: () => suggestHandle(language),
        isTaken: (e) => e instanceof CirclesHttpError && e.key === "handleTaken",
      });
      setHandle(saved.handle);
      const joined = code.trim() ? await api.joinPrivate(code) : await api.joinPublic();
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
            onChangeText={(next) => {
              setHandle(next);
              setSuggested(false);
            }}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          {problem ? <Hint>{t(`circles.handleProblem.${problem}`)}</Hint> : null}
          <Button
            tone="plain"
            label={t("circles.onboarding.shuffle")}
            onPress={() => {
              setHandle(suggestHandle(language));
              setSuggested(true);
            }}
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

      <Section title={t("circles.onboarding.inviteTitle")}>
        <Panel>
          <Hint>{t("circles.onboarding.inviteHint")}</Hint>
          <TextInput
            accessibilityLabel={t("circles.home.codeLabel")}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={t("circles.home.codePlaceholder")}
            placeholderTextColor={theme.muted}
            maxLength={12}
            value={code}
            onChangeText={setCode}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
        </Panel>
      </Section>

      {error ? <Text style={{ color: theme.text }}>{error}</Text> : null}
      <Button
        label={
          busy
            ? t("circles.loading")
            : code.trim()
              ? t("circles.home.joinWithCode")
              : t("circles.onboarding.join")
        }
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
