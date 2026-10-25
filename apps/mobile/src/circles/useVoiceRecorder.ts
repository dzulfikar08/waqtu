import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";

import { clampVoiceSeconds } from "./logic";

export interface VoiceDraft {
  uri: string;
  seconds: number;
}

/** m4a (AAC in an MPEG-4 container) is what both platforms produce with these options. */
export const VOICE_MIME = "audio/mp4";

export type VoiceProblem = "denied" | "failed";

/**
 * Asks for the microphone and switches the audio session to recording. False when the permission
 * is denied. Shared by the voice-note recorder and the PCM capture of the recitation check.
 */
export async function beginRecordingSession(): Promise<boolean> {
  const { granted } = await requestRecordingPermissionsAsync();
  if (!granted) return false;
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
  return true;
}

export async function endRecordingSession(): Promise<void> {
  await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
}

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
      if (!(await beginRecordingSession())) {
        setProblem("denied");
        return;
      }
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
      const seconds = clampVoiceSeconds(recorder.getStatus().durationMillis / 1000);
      await recorder.stop();
      await endRecordingSession();
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
