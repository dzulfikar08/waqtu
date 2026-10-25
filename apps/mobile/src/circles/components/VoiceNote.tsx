import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioSource,
} from "expo-audio";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTranslation } from "@/i18n";
import { radius, spacing, useTheme } from "@/theme";

import type { CirclesApi } from "../api";
import { formatDuration } from "../logic";
import type { PostMedia } from "../types";

/** Playback is lazy: no native player exists until the first tap, so a long feed stays cheap. */
export function VoiceNote({
  api,
  circleId,
  media,
}: {
  api: CirclesApi;
  circleId: string;
  media: PostMedia;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [source, setSource] = useState<AudioSource | null>(null);
  const [failed, setFailed] = useState(false);

  const open = async () => {
    setFailed(false);
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      setSource(await api.mediaSource(circleId, media.id));
    } catch {
      setFailed(true);
    }
  };

  return (
    <View style={[styles.box, { borderColor: theme.border, backgroundColor: theme.background }]}>
      {source ? (
        <ActivePlayer source={source} total={media.durationSeconds} />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("circles.circle.play")}
          onPress={() => void open()}
          style={styles.row}
        >
          <Text style={[styles.icon, { color: theme.accent }]}>▶</Text>
          <Text style={{ color: theme.text }}>{formatDuration(media.durationSeconds)}</Text>
        </Pressable>
      )}
      {failed ? (
        <Text style={[styles.error, { color: theme.muted }]}>{t("circles.circle.playFailed")}</Text>
      ) : null}
    </View>
  );
}

/** Plays `source` from mount; also used for private halaqah voice reflections (a local file). */
export function ActivePlayer({ source, total }: { source: AudioSource; total: number }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    try {
      player.play();
    } catch {
      setFailed(true);
    }
  }, [player]);

  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      void player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  const toggle = () => {
    if (status.playing) player.pause();
    else player.play();
  };

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          status.playing ? t("circles.circle.pausePlayback") : t("circles.circle.play")
        }
        onPress={toggle}
        style={styles.row}
      >
        <Text style={[styles.icon, { color: theme.accent }]}>{status.playing ? "❚❚" : "▶"}</Text>
        <Text style={{ color: theme.text }}>
          {formatDuration(status.currentTime)} / {formatDuration(status.duration || total)}
        </Text>
      </Pressable>
      {failed ? (
        <Text style={[styles.error, { color: theme.muted }]}>{t("circles.circle.playFailed")}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  row: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: { fontSize: 18 },
  error: { fontSize: 13, paddingBottom: spacing.xs },
});
