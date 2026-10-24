import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useVoiceRecorder } from "@/circles/useVoiceRecorder";
import { useTranslation } from "@/i18n";
import { Button, Hint } from "@/ramadhan/components/fields";
import { radius, spacing, useTheme } from "@/theme";
import { deleteRecording, saveRecording, type StoredRecording } from "../db";
import { formatSeconds } from "../format";
import { keepRecording, recordingUri, removeRecordings } from "../recordings";

const MAX_SECONDS = 180;

/**
 * Record a recitation of the unit and listen back. One recording per unit, kept in the app's
 * private folder on this phone only; recording again replaces it and it can be deleted.
 */
export function Recitation({ unit, saved }: { unit: number; saved: StoredRecording | undefined }) {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const theme = useTheme();
  const recorder = useVoiceRecorder(MAX_SECONDS);
  const [failed, setFailed] = useState(false);

  const draft = recorder.draft;
  useEffect(() => {
    if (!draft) return;
    let cancelled = false;
    void (async () => {
      try {
        const file = await keepRecording(draft.uri, unit);
        const replaced = await saveRecording(db, unit, file, draft.seconds);
        removeRecordings([replaced]);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        recorder.discard();
      }
    })();
    return () => {
      cancelled = true;
    };
    // `recorder.discard` is stable; the draft object identifies one finished recording.
  }, [draft, unit, db, recorder.discard]);

  const remove = async () => {
    removeRecordings([await deleteRecording(db, unit)]);
  };

  const problem =
    recorder.problem === "denied"
      ? "recordDenied"
      : recorder.problem !== null || failed
        ? "recordFailed"
        : null;

  return (
    <View style={styles.box}>
      <Hint>{t("hafalan.recitationHint")}</Hint>
      {recorder.recording ? (
        <>
          <Text style={{ color: theme.text, fontWeight: "600" }}>
            {t("hafalan.recording", { time: formatSeconds(recorder.elapsedSeconds) })}
          </Text>
          <Button label={t("hafalan.stop")} onPress={() => void recorder.stop()} />
        </>
      ) : (
        <Button
          label={t("hafalan.record")}
          tone={saved ? "plain" : "primary"}
          onPress={() => {
            setFailed(false);
            void recorder.start();
          }}
        />
      )}
      {problem ? <Text style={{ color: theme.muted }}>{t(`hafalan.${problem}`)}</Text> : null}
      {saved && !recorder.recording ? (
        <SavedPlayer
          key={saved.file}
          name={saved.file}
          seconds={saved.seconds}
          onDelete={() => void remove()}
        />
      ) : null}
    </View>
  );
}

function SavedPlayer({
  name,
  seconds,
  onDelete,
}: {
  name: string;
  seconds: number;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const player = useAudioPlayer(recordingUri(name));
  const status = useAudioPlayerStatus(player);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      void player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  const toggle = async () => {
    try {
      if (status.playing) player.pause();
      else {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
        player.play();
      }
      setFailed(false);
    } catch {
      setFailed(true);
    }
  };

  return (
    <View style={[styles.player, { borderColor: theme.border, backgroundColor: theme.background }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? t("hafalan.pause") : t("hafalan.play")}
        onPress={() => void toggle()}
        style={styles.row}
      >
        <Text style={{ color: theme.accent, fontSize: 18 }}>{status.playing ? "❚❚" : "▶"}</Text>
        <Text style={{ color: theme.text }}>
          {formatSeconds(status.currentTime)} / {formatSeconds(status.duration || seconds)}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("hafalan.deleteRecording")}
        onPress={onDelete}
        style={styles.row}
      >
        <Text style={{ color: theme.muted }}>{t("hafalan.deleteRecording")}</Text>
      </Pressable>
      {failed ? <Text style={{ color: theme.muted }}>{t("hafalan.playFailed")}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm },
  player: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  row: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.md },
});
