import { useAudioStream, type AudioStreamBuffer } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  beginRecordingSession,
  endRecordingSession,
  type VoiceProblem,
} from "@/circles/useVoiceRecorder";
import { pcmSeconds, wavFile } from "./wav";

/** whisper.cpp works at 16 kHz mono; asking for it saves resampling (the device may still differ). */
const SAMPLE_RATE = 16_000;

export interface PcmTake {
  /** A 16-bit PCM WAV file, at the rate the microphone delivered. */
  wav: Uint8Array;
  seconds: number;
}

/**
 * Records the microphone as raw 16-bit PCM (expo-audio's `AudioStream`), because whisper.rn reads
 * WAV and not the m4a the hafalan recorder writes. Same microphone permission and audio-session
 * handling as `useVoiceRecorder`; nothing is written to disk here.
 */
export function usePcmCapture(maxSeconds: number) {
  const chunks = useRef<Uint8Array[]>([]);
  const bytes = useRef(0);
  const format = useRef({ sampleRate: SAMPLE_RATE, channels: 1 });
  const [recording, setRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [take, setTake] = useState<PcmTake | null>(null);
  const [problem, setProblem] = useState<VoiceProblem | null>(null);
  const stopRef = useRef<() => void>(() => {});

  const onBuffer = useCallback(
    (buffer: AudioStreamBuffer) => {
      // Copy: the next buffer may reuse the native memory.
      const chunk = new Uint8Array(buffer.data.slice(0));
      chunks.current.push(chunk);
      bytes.current += chunk.length;
      format.current = { sampleRate: buffer.sampleRate, channels: buffer.channels };
      const seconds = pcmSeconds(bytes.current, buffer.sampleRate, buffer.channels);
      setElapsedSeconds(Math.floor(seconds));
      if (seconds >= maxSeconds) stopRef.current();
    },
    [maxSeconds],
  );

  const { stream } = useAudioStream({
    sampleRate: SAMPLE_RATE,
    channels: 1,
    encoding: "int16",
    onBuffer,
  });

  const start = useCallback(async () => {
    setProblem(null);
    setTake(null);
    chunks.current = [];
    bytes.current = 0;
    setElapsedSeconds(0);
    try {
      if (!(await beginRecordingSession())) {
        setProblem("denied");
        return;
      }
      await stream.start();
      setRecording(true);
    } catch {
      setProblem("failed");
    }
  }, [stream]);

  const stop = useCallback(() => {
    if (!stream.isStreaming && chunks.current.length === 0) return;
    try {
      stream.stop();
    } catch {
      // Already stopped by the system (an interruption); keep what was captured.
    }
    setRecording(false);
    void endRecordingSession().catch(() => {});
    const captured = chunks.current;
    chunks.current = [];
    const { sampleRate, channels } = format.current;
    if (bytes.current === 0) {
      setProblem("failed");
      return;
    }
    setTake({
      wav: wavFile(captured, sampleRate, channels),
      seconds: pcmSeconds(bytes.current, sampleRate, channels),
    });
    bytes.current = 0;
  }, [stream]);
  stopRef.current = stop;

  const discard = useCallback(() => {
    setTake(null);
    setProblem(null);
  }, []);

  // Leaving the screen mid-recording releases the microphone.
  useEffect(
    () => () => {
      try {
        if (stream.isStreaming) stream.stop();
      } catch {
        // Released with the shared object.
      }
    },
    [stream],
  );

  return { recording, elapsedSeconds, take, problem, start, stop, discard };
}
