import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PressableScale, type IconName } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { HIT, radius, spacing, tabular, typography, useTheme } from "@/theme";

import type { CirclesApi } from "../api";
import { CirclesHttpError } from "../api";
import { formatDuration } from "../logic";
import type { Post } from "../types";
import { useVoiceRecorder, VOICE_MIME } from "../useVoiceRecorder";
import { TextField } from "./TextField";

/** Text and/or one voice note. The halaqah day, when the screen was opened from one, rides along. */
export function Composer({
  api,
  circleId,
  maxText,
  maxVoiceSeconds,
  halaqahDayId,
  onPosted,
  onNotice,
}: {
  api: CirclesApi;
  circleId: string;
  maxText: number;
  maxVoiceSeconds: number;
  halaqahDayId?: string;
  onPosted: (post: Post) => void;
  onNotice: (message: string) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const voice = useVoiceRecorder(maxVoiceSeconds);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const canSend = !sending && !voice.recording && (text.trim() !== "" || voice.draft !== null);

  const send = async () => {
    setSending(true);
    try {
      let mediaId: string | undefined;
      if (voice.draft) {
        mediaId = (
          await api.uploadVoice(circleId, voice.draft.uri, VOICE_MIME, voice.draft.seconds)
        ).mediaId;
      }
      const post = await api.post(circleId, {
        ...(text.trim() ? { text: text.trim() } : {}),
        ...(mediaId ? { mediaId } : {}),
        ...(halaqahDayId ? { halaqahDayId } : {}),
      });
      setText("");
      voice.discard();
      onPosted(post);
    } catch (e) {
      onNotice(t(`circles.errors.${e instanceof CirclesHttpError ? e.key : "generic"}`));
    } finally {
      setSending(false);
    }
  };

  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: theme.surface,
          borderColor: theme.separator,
          paddingBottom: spacing.sm + 4 + insets.bottom,
        },
      ]}
    >
      {halaqahDayId ? (
        <View style={styles.status}>
          <Ionicons
            name="link"
            size={14}
            color={theme.secondary}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text style={[typography.footnote, styles.grow, { color: theme.secondary }]}>
            {t("circles.circle.halaqahLinked", { day: halaqahDayId })}
          </Text>
        </View>
      ) : null}
      <TextField
        accessibilityLabel={t("circles.circle.write")}
        multiline
        maxLength={maxText}
        placeholder={t("circles.circle.write")}
        value={text}
        onChangeText={setText}
        style={styles.input}
      />
      {voice.recording ? (
        <View style={styles.status}>
          <View style={[styles.dot, { backgroundColor: theme.danger }]} />
          <Text style={[typography.subhead, tabular, styles.grow, { color: theme.text }]}>
            {t("circles.circle.recording", { time: formatDuration(voice.elapsedSeconds) })}
          </Text>
        </View>
      ) : voice.draft ? (
        <View style={styles.status}>
          <Ionicons
            name="mic"
            size={16}
            color={theme.accent}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text style={[typography.subhead, tabular, styles.grow, { color: theme.text }]}>
            {t("circles.circle.voiceReady", { time: formatDuration(voice.draft.seconds) })}
          </Text>
        </View>
      ) : null}
      {voice.problem ? (
        <Text style={[typography.footnote, { color: theme.danger }]}>
          {voice.problem === "denied"
            ? t("circles.circle.micDenied")
            : t("circles.circle.recordFailed")}
        </Text>
      ) : null}
      <View style={styles.actions}>
        {voice.recording ? (
          <Pill
            icon="stop"
            tint={theme.danger}
            label={t("circles.circle.stopRecording")}
            onPress={() => void voice.stop()}
          />
        ) : voice.draft ? (
          <Pill icon="trash-outline" label={t("circles.circle.discard")} onPress={voice.discard} />
        ) : (
          <Pill
            icon="mic-outline"
            label={t("circles.circle.voice")}
            onPress={() => void voice.start()}
          />
        )}
        <PressableScale
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={() => void send()}
          style={[styles.send, { backgroundColor: theme.accent }]}
        >
          <Ionicons name="paper-plane" size={16} color={theme.accentText} />
          <Text style={[typography.callout, styles.sendLabel, { color: theme.accentText }]}>
            {sending ? t("circles.circle.posting") : t("circles.circle.send")}
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

/** Outlined round-ended button with a leading glyph. */
function Pill({
  icon,
  label,
  tint,
  onPress,
}: {
  icon: IconName;
  label: string;
  tint?: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const color = tint ?? theme.text;
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
      scaleTo={0.95}
      style={[styles.pill, { borderColor: tint ?? theme.border }]}
    >
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[typography.subhead, styles.pillLabel, { color }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 4,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  grow: { flex: 1 },
  input: { minHeight: 64, maxHeight: 160, textAlignVertical: "top" },
  status: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  pill: {
    minHeight: HIT - 4,
    paddingHorizontal: spacing.md - 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  pillLabel: { fontWeight: "600" },
  send: {
    minHeight: HIT,
    paddingHorizontal: spacing.md + 4,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  sendLabel: { fontWeight: "700" },
});
