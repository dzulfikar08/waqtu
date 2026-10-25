import { Ionicons } from "@expo/vector-icons";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioSource,
} from "expo-audio";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTranslation } from "@/i18n";
import { radius, spacing, tabular, typography, useTheme } from "@/theme";

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
    <View style={[styles.box, { backgroundColor: theme.surfaceAlt }]}>
      {source ? (
        <ActivePlayer source={source} total={media.durationSeconds} />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("circles.circle.play")}
          onPress={() => void open()}
          style={styles.row}
        >
          <PlayDisc playing={false} />
          <Ionicons
            name="mic"
            size={16}
            color={theme.muted}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text style={[typography.callout, tabular, styles.time, { color: theme.text }]}>
            {formatDuration(media.durationSeconds)}
          </Text>
        </Pressable>
      )}
      {failed ? (
        <Text style={[typography.footnote, styles.error, { color: theme.danger }]}>
          {t("circles.circle.playFailed")}
        </Text>
      ) : null}
    </View>
  );
}

/** Filled accent disc with a play or pause glyph, readable on either theme. */
function PlayDisc({ playing }: { playing: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.disc, { backgroundColor: theme.accent }]}>
      <Ionicons
        name={playing ? "pause" : "play"}
        size={18}
        color={theme.accentText}
        style={playing ? null : styles.playNudge}
      />
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

  const length = status.duration || total;
  const fraction = length > 0 ? Math.min(1, status.currentTime / length) : 0;

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
        <PlayDisc playing={status.playing} />
        <View style={styles.grow}>
          <View style={[styles.track, { backgroundColor: theme.border }]}>
            <View
              style={[
                styles.fill,
                { backgroundColor: theme.accent, width: `${Math.round(fraction * 100)}%` },
              ]}
            />
          </View>
        </View>
        <Text style={[typography.footnote, tabular, { color: theme.text }]}>
          {formatDuration(status.currentTime)} / {formatDuration(length)}
        </Text>
      </Pressable>
      {failed ? (
        <Text style={[typography.footnote, styles.error, { color: theme.danger }]}>
          {t("circles.circle.playFailed")}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  row: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
  grow: { flex: 1 },
  time: { fontWeight: "600" },
  disc: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  playNudge: { marginLeft: 2 },
  track: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: 4, borderRadius: 2 },
  error: { paddingBottom: spacing.xs },
});
