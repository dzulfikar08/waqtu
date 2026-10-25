import { Ionicons } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useVoiceRecorder } from "@/circles/useVoiceRecorder";
import { PressableScale } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { Button, Hint } from "@/ramadhan/components/fields";
import { HIT, radius, spacing, tabular, typography, useTheme } from "@/theme";
import { MicButton } from "./MicButton";
import { deleteRecording, saveRecording, type StoredRecording } from "../db";
import { formatSeconds } from "../format";
import { addMark, ayahAt, markOf, type AyahMarks } from "../marks";
import { keepRecording, recordingUri, removeRecordings } from "../recordings";

const MAX_SECONDS = 180;

/** Plays the saved recording from the start of an ayah of the unit (counted from 0); set while a recording is playable. */
export type SeekToAyah = (ayah: number) => void;

/**
 * Record a recitation of the unit and listen back. One recording per unit, kept in the app's
 * private folder on this phone only; recording again replaces it and it can be deleted.
 * "Next ayah" while recording marks where each ayah starts; playback then reports the ayah being
 * recited through `onActiveAyah` and `seekRef` jumps to an ayah.
 */
export function Recitation({
  unit,
  saved,
  ayahCount,
  onActiveAyah,
  seekRef,
}: {
  unit: number;
  saved: StoredRecording | undefined;
  ayahCount: number;
  onActiveAyah: (ayah: number | null) => void;
  seekRef: RefObject<SeekToAyah | null>;
}) {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const theme = useTheme();
  const recorder = useVoiceRecorder(MAX_SECONDS);
  const [failed, setFailed] = useState(false);
  const [marks, setMarks] = useState<AyahMarks>([]);
  // Read when the finished draft is saved; the draft effect must not rerun when marks change.
  const marksRef = useRef(marks);
  marksRef.current = marks;
  const [playingAyah, setPlayingAyah] = useState<number | null>(null);

  const active = recorder.recording ? Math.max(0, marks.length - 1) : playingAyah;
  useEffect(() => onActiveAyah(active), [active, onActiveAyah]);
  useEffect(() => () => onActiveAyah(null), [onActiveAyah]);

  const draft = recorder.draft;
  useEffect(() => {
    if (!draft) return;
    let cancelled = false;
    void (async () => {
      try {
        const file = await keepRecording(draft.uri, unit);
        const replaced = await saveRecording(db, unit, file, draft.seconds, marksRef.current);
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
          <View style={styles.live}>
            <View style={[styles.dot, { backgroundColor: theme.danger }]} />
            <Text style={[typography.headline, tabular, { color: theme.text }]}>
              {t("hafalan.recording", { time: formatSeconds(recorder.elapsedSeconds) })}
            </Text>
          </View>
          <MicButton recording label={t("hafalan.stop")} onPress={() => void recorder.stop()} />
          {ayahCount > 1 ? (
            <Button
              label={t("hafalan.nextAyah", {
                n: Math.min(marks.length + 1, ayahCount),
                total: ayahCount,
              })}
              disabled={marks.length >= ayahCount}
              onPress={() => setMarks((m) => addMark(m, recorder.elapsedSeconds, ayahCount))}
            />
          ) : null}
        </>
      ) : (
        <MicButton
          label={t("hafalan.record")}
          onPress={() => {
            setFailed(false);
            setMarks([0]);
            void recorder.start();
          }}
        />
      )}
      {ayahCount > 1 ? <Hint>{t("hafalan.marksHint")}</Hint> : null}
      {problem ? (
        <Text style={[typography.subhead, { color: theme.danger }]}>{t(`hafalan.${problem}`)}</Text>
      ) : null}
      {saved && !recorder.recording ? (
        <SavedPlayer
          key={saved.file}
          name={saved.file}
          seconds={saved.seconds}
          marks={saved.marks}
          onAyah={setPlayingAyah}
          seekRef={seekRef}
          onDelete={() => void remove()}
        />
      ) : null}
    </View>
  );
}

function SavedPlayer({
  name,
  seconds,
  marks,
  onAyah,
  seekRef,
  onDelete,
}: {
  name: string;
  seconds: number;
  marks: AyahMarks;
  onAyah: (ayah: number | null) => void;
  seekRef: RefObject<SeekToAyah | null>;
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

  // Before the first play (and after the end) nothing is highlighted; a pause keeps the ayah lit.
  const ayah = status.playing || status.currentTime > 0 ? ayahAt(marks, status.currentTime) : null;
  useEffect(() => onAyah(ayah), [ayah, onAyah]);
  useEffect(() => () => onAyah(null), [onAyah]);

  useEffect(() => {
    if (marks.length === 0) return;
    seekRef.current = (index) => {
      const at = markOf(marks, index);
      if (at === null) return;
      void (async () => {
        try {
          await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
          await player.seekTo(at);
          player.play();
          setFailed(false);
        } catch {
          setFailed(true);
        }
      })();
    };
    return () => {
      seekRef.current = null;
    };
  }, [marks, player, seekRef]);

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

  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;
  return (
    <View style={[styles.player, { backgroundColor: theme.surfaceAlt }]}>
      <View style={styles.playerRow}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={status.playing ? t("hafalan.pause") : t("hafalan.play")}
          onPress={() => void toggle()}
          scaleTo={0.9}
          style={[styles.play, { backgroundColor: theme.accent }]}
        >
          <Ionicons
            name={status.playing ? "pause" : "play"}
            size={20}
            color={theme.accentText}
            style={status.playing ? undefined : styles.playGlyph}
          />
        </PressableScale>
        <View style={styles.timeline}>
          <View style={[styles.track, { backgroundColor: theme.border }]}>
            <View
              style={[
                styles.fill,
                { backgroundColor: theme.accent, width: `${Math.round(progress * 100)}%` },
              ]}
            />
          </View>
          <Text style={[typography.footnote, tabular, { color: theme.muted }]}>
            {formatSeconds(status.currentTime)} / {formatSeconds(status.duration || seconds)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("hafalan.deleteRecording")}
          onPress={onDelete}
          hitSlop={4}
          style={({ pressed }) => [
            styles.delete,
            { backgroundColor: pressed ? theme.dangerSoft : "transparent" },
          ]}
        >
          <Ionicons name="trash-outline" size={20} color={theme.danger} />
        </Pressable>
      </View>
      {failed ? (
        <Text style={[typography.footnote, { color: theme.danger }]}>
          {t("hafalan.playFailed")}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.md },
  live: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  player: { borderRadius: radius.md, padding: spacing.sm + 2, gap: spacing.xs },
  playerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md - 4 },
  play: {
    width: HIT,
    height: HIT,
    borderRadius: HIT / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  playGlyph: { marginLeft: 3 },
  timeline: { flex: 1, gap: spacing.xs + 2 },
  track: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: 4, borderRadius: 2 },
  delete: {
    width: HIT,
    height: HIT,
    borderRadius: HIT / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
