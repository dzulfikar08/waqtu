import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";

export interface VoiceDraft {
  uri: string;
  seconds: number;
}

/** m4a (AAC in an MPEG-4 container) is what both platforms produce with these options. */
export const VOICE_MIME = "audio/mp4";

export type VoiceProblem = "denied" | "failed";

/** One voice note at a time: record, stop (or hit the limit), keep the draft until sent or discarded. */
export function useVoiceRecorder(maxSeconds: number) {
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    numberOfChannels: 1,
    bitRate: 64_000,
  });
  const state = useAudioRecorderState(recorder, 250);
  const [draft, setDraft] = useState<VoiceDraft | null>(null);
  const [problem, setProblem] = useState<VoiceProblem | null>(null);
  const stopping = useRef(false);

  const start = useCallback(async () => {
    setProblem(null);
    setDraft(null);
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setProblem("denied");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      setProblem("failed");
    }
  }, [recorder]);

  const stop = useCallback(async () => {
    if (stopping.current) return;
    stopping.current = true;
    try {
      const seconds = Math.max(1, Math.round(recorder.getStatus().durationMillis / 1000));
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (recorder.uri) setDraft({ uri: recorder.uri, seconds });
      else setProblem("failed");
    } catch {
      setProblem("failed");
    } finally {
      stopping.current = false;
    }
  }, [recorder]);

  const discard = useCallback(() => {
    setDraft(null);
    setProblem(null);
  }, []);

  useEffect(() => {
    if (state.isRecording && state.durationMillis >= maxSeconds * 1000) void stop();
  }, [state.isRecording, state.durationMillis, maxSeconds, stop]);

  return {
    recording: state.isRecording,
    elapsedSeconds: Math.floor(state.durationMillis / 1000),
    draft,
    problem,
    start,
    stop,
    discard,
  };
}
