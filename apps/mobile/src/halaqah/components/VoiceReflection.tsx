import { setAudioModeAsync } from "expo-audio";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ActivePlayer } from "@/circles/components/VoiceNote";
import { formatDuration, MAX_VOICE_SECONDS } from "@/circles/logic";
import { useVoiceRecorder } from "@/circles/useVoiceRecorder";
import { useTranslation } from "@/i18n";
import { Button, ButtonRow, Hint } from "@/ramadhan/components/fields";
import { radius, spacing, tabular, typography, useTheme } from "@/theme";
import {
  deleteVoiceReflection,
  getVoiceReflection,
  saveVoiceReflection,
  type VoiceReflection as Voice,
} from "../db";
import { keepReflectionVoice, reflectionVoiceUri, removeReflectionVoice } from "../recordings";

/** Record, replay, re-record or delete the day's private voice reflection. Kept on this device. */
export function VoiceReflection({ programId, day }: { programId: string; day: number }) {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const theme = useTheme();
  const recorder = useVoiceRecorder(MAX_VOICE_SECONDS);
  const [voice, setVoice] = useState<Voice | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const { draft, discard } = recorder;

  useEffect(() => {
    let cancelled = false;
    void getVoiceReflection(db, programId, day).then((row) => {
      if (cancelled) return;
      setVoice(row);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [db, programId, day]);

  // A finished recording moves into the private folder and replaces the day's previous one.
  useEffect(() => {
    if (!draft) return;
    let cancelled = false;
    void (async () => {
      try {
        const file = await keepReflectionVoice(draft.uri, day);
        const next = { file, seconds: draft.seconds };
        removeReflectionVoice(await saveVoiceReflection(db, programId, day, next));
        if (!cancelled) {
          setPlaying(false);
          setVoice(next);
        }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) discard();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft, discard, db, programId, day]);

  if (!loaded) return null;

  const remove = async () => {
    setPlaying(false);
    removeReflectionVoice(await deleteVoiceReflection(db, programId, day));
    setVoice(null);
  };

  const play = async () => {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    setPlaying(true);
  };

  return (
    <View style={styles.root}>
      {recorder.recording ? (
        <View style={[styles.live, { backgroundColor: theme.dangerSoft }]}>
          <View style={[styles.dot, { backgroundColor: theme.danger }]} />
          <Text style={[typography.callout, tabular, styles.status, { color: theme.text }]}>
            {t("circles.circle.recording", { time: formatDuration(recorder.elapsedSeconds) })}
          </Text>
          <Button label={t("halaqah.voice.stop")} onPress={() => void recorder.stop()} />
        </View>
      ) : voice ? (
        <>
          {playing ? (
            <ActivePlayer source={{ uri: reflectionVoiceUri(voice.file) }} total={voice.seconds} />
          ) : (
            <Button
              tone="plain"
              label={t("halaqah.voice.play", { time: formatDuration(voice.seconds) })}
              onPress={() => void play()}
            />
          )}
          <ButtonRow>
            <Button
              tone="plain"
              label={t("halaqah.voice.rerecord")}
              onPress={() => {
                setPlaying(false);
                setFailed(false);
                void recorder.start();
              }}
            />
            <Button
              tone="plain"
              label={t("halaqah.voice.delete")}
              onPress={() => void remove().catch(() => {})}
            />
          </ButtonRow>
        </>
      ) : (
        <Button
          tone="plain"
          label={t("halaqah.voice.record")}
          onPress={() => {
            setFailed(false);
            void recorder.start();
          }}
        />
      )}
      {recorder.problem === "denied" ? <Hint>{t("circles.circle.micDenied")}</Hint> : null}
      {recorder.problem === "failed" || failed ? (
        <Hint>{t("circles.circle.recordFailed")}</Hint>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  live: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingLeft: spacing.md - 4,
    padding: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  status: { flex: 1, fontWeight: "600" },
});
