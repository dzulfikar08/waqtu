import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { CIRCLES_HERO, GlowHero } from "@/components/GlowHero";
import { Row, Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { Button, Hint, Panel } from "@/ramadhan/components/fields";
import { radius, spacing, typography, useTheme } from "@/theme";

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
import { TextField } from "./TextField";

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
      <GlowHero
        palette={CIRCLES_HERO}
        icon="people"
        title={t("circles.onboarding.title")}
        body={t("circles.onboarding.body")}
      />

      <Section title={t("circles.onboarding.handle")} icon="at-outline" hue="circles">
        <Panel>
          <TextField
            accessibilityLabel={t("circles.onboarding.handle")}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={24}
            value={handle}
            onChangeText={(next) => {
              setHandle(next);
              setSuggested(false);
            }}
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

      <Section title={t("circles.onboarding.gender")} icon="people-outline" hue="circles">
        <Row
          icon="man-outline"
          hue="circles"
          label={t("circles.onboarding.ikhwan")}
          selected={gender === "ikhwan"}
          onPress={() => setGender("ikhwan")}
        />
        <Row
          icon="woman-outline"
          hue="circles"
          label={t("circles.onboarding.akhwat")}
          selected={gender === "akhwat"}
          onPress={() => setGender("akhwat")}
        />
        <Panel>
          <Hint>{t("circles.onboarding.genderHint")}</Hint>
        </Panel>
      </Section>

      <Section title={t("circles.onboarding.inviteTitle")} icon="key-outline" hue="circles">
        <Panel>
          <Hint>{t("circles.onboarding.inviteHint")}</Hint>
          <TextField
            accessibilityLabel={t("circles.home.codeLabel")}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={t("circles.home.codePlaceholder")}
            maxLength={12}
            value={code}
            onChangeText={setCode}
          />
        </Panel>
      </Section>

      {error ? (
        <View style={[styles.error, { backgroundColor: theme.dangerSoft }]}>
          <Ionicons
            name="alert-circle"
            size={18}
            color={theme.danger}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text style={[typography.subhead, styles.grow, { color: theme.text }]}>{error}</Text>
        </View>
      ) : null}
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
      <View style={styles.privacy}>
        <Ionicons
          name="lock-closed-outline"
          size={14}
          color={theme.muted}
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={styles.privacyIcon}
        />
        <View style={styles.grow}>
          <Hint>{t("circles.onboarding.privacy")}</Hint>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  grow: { flex: 1 },
  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md - 4,
    borderRadius: radius.md,
  },
  privacy: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.xs },
  privacyIcon: { marginTop: 2 },
});
