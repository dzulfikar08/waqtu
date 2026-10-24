import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useTranslation } from "@/i18n";
import { radius, spacing, useTheme } from "@/theme";

import type { CirclesApi } from "../api";
import { CirclesHttpError } from "../api";
import { formatDuration } from "../logic";
import type { Post } from "../types";
import { useVoiceRecorder, VOICE_MIME } from "../useVoiceRecorder";

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
    <View style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {halaqahDayId ? (
        <Text style={[styles.meta, { color: theme.secondary }]}>
          {t("circles.circle.halaqahLinked", { day: halaqahDayId })}
        </Text>
      ) : null}
      <TextInput
        accessibilityLabel={t("circles.circle.write")}
        multiline
        maxLength={maxText}
        placeholder={t("circles.circle.write")}
        placeholderTextColor={theme.muted}
        value={text}
        onChangeText={setText}
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
      />
      {voice.recording ? (
        <View style={styles.row}>
          <Text style={{ color: theme.text, flex: 1 }}>
            {t("circles.circle.recording", { time: formatDuration(voice.elapsedSeconds) })}
          </Text>
          <Pill label={t("circles.circle.stopRecording")} onPress={() => void voice.stop()} />
        </View>
      ) : voice.draft ? (
        <View style={styles.row}>
          <Text style={{ color: theme.text, flex: 1 }}>
            {t("circles.circle.voiceReady", { time: formatDuration(voice.draft.seconds) })}
          </Text>
          <Pill label={t("circles.circle.discard")} onPress={voice.discard} />
        </View>
      ) : (
        <View style={styles.row}>
          <Pill label={`🎙 ${t("circles.circle.voice")}`} onPress={() => void voice.start()} />
        </View>
      )}
      {voice.problem ? (
        <Text style={[styles.meta, { color: theme.muted }]}>
          {voice.problem === "denied"
            ? t("circles.circle.micDenied")
            : t("circles.circle.recordFailed")}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSend }}
        disabled={!canSend}
        onPress={() => void send()}
        style={[styles.send, { backgroundColor: theme.accent, opacity: canSend ? 1 : 0.5 }]}
      >
        <Text style={{ color: theme.accentText, fontWeight: "700" }}>
          {sending ? t("circles.circle.posting") : t("circles.circle.send")}
        </Text>
      </Pressable>
    </View>
  );
}

function Pill({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.pill, { borderColor: theme.border }]}
    >
      <Text style={{ color: theme.text }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    minHeight: 64,
    maxHeight: 160,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: 16,
    textAlignVertical: "top",
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pill: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  send: {
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: { fontSize: 13 },
});
