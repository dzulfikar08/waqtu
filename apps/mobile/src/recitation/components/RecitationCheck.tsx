import type { HafalanUnit } from "@waqtu/core";
import type { File } from "expo-file-system";
import * as Network from "expo-network";
import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Row } from "@/components/ui";
import { formatSeconds } from "@/hafalan/format";
import { useTranslation } from "@/i18n";
import { Button, ButtonRow, Hint, ProgressBar } from "@/ramadhan/components/fields";
import { spacing, useTheme } from "@/theme";
import { checkId, checkRecitation, checkView, rangeOf, type CheckView } from "../check";
import {
  addCheck,
  clearChecks,
  readChecks,
  removeTake,
  shareChecks,
  writeTake,
} from "../checksStore";
import { downloadFraction, megabytes, networkWarning, type NetworkWarning } from "../download";
import { releaseModel, transcribe } from "../engine";
import {
  cancelDownload,
  deleteModel,
  pauseDownload,
  startDownload,
  useModelState,
} from "../modelStore";
import { MODEL_IDS, MODELS, type ModelId } from "../models";
import { usePcmCapture } from "../usePcmCapture";
import { useRecitationDev } from "../useDevSettings";

/** Same limit as the hafalan recording: a unit is about half a page. */
const MAX_SECONDS = 180;

type Phase =
  | { kind: "idle" }
  | { kind: "transcribing"; percent: number }
  | { kind: "done"; view: CheckView; text: string; seconds: number; audio: number }
  | { kind: "failed" };

/**
 * Developer-only recitation check on the unit screen: download the model once, record, transcribe
 * on the phone, align with the unit's ayat and report the mistakes; `onView` hands the highlights
 * to `UnitText`. Each transcript is kept for export as a harness manifest.
 */
export function RecitationCheck({
  unit,
  unitIndex,
  onView,
}: {
  unit: Pick<HafalanUnit, "start" | "end">;
  unitIndex: number;
  onView: (view: CheckView | null) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const dev = useRecitationDev();
  const model = MODELS[dev.model];
  const download = useModelState(dev.model);
  const capture = usePcmCapture(MAX_SECONDS);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [records, setRecords] = useState(readChecks);
  const [message, setMessage] = useState<string | null>(null);
  const job = useRef<{ stop: () => void } | null>(null);

  // Leaving the screen stops a transcription and frees the model's memory.
  useEffect(
    () => () => {
      job.current?.stop();
      void releaseModel();
      onView(null);
    },
    [onView],
  );

  const take = capture.take;
  useEffect(() => {
    if (!take) return;
    capture.discard();
    const recordedAt = new Date();
    let file: File | null = null;
    void (async () => {
      setPhase({ kind: "transcribing", percent: 0 });
      try {
        file = writeTake(take.wav);
        const run = transcribe(dev.model, file.uri, (percent) =>
          setPhase({ kind: "transcribing", percent }),
        );
        job.current = run;
        const result = await run.promise;
        if (!result) {
          setPhase({ kind: "idle" });
          return;
        }
        const view = checkView(checkRecitation(unit, result.text));
        onView(view);
        setPhase({
          kind: "done",
          view,
          text: result.text,
          seconds: result.seconds,
          audio: take.seconds,
        });
        setRecords(
          addCheck({
            id: checkId(unitIndex, recordedAt),
            unit: unitIndex,
            range: rangeOf(unit),
            text: result.text,
            model: dev.model,
            seconds: Math.round(take.seconds * 10) / 10,
            recordedAt: recordedAt.toISOString(),
            transcribeSeconds: Math.round(result.seconds * 10) / 10,
          }),
        );
      } catch {
        setPhase({ kind: "failed" });
      } finally {
        job.current = null;
        if (file) removeTake(file);
      }
    })();
    // One run per finished take; `capture.discard` is stable.
  }, [take, capture.discard, dev.model, unit, unitIndex, onView]);

  const begin = async () => {
    setMessage(null);
    let warning: NetworkWarning = null;
    try {
      const network = await Network.getNetworkStateAsync();
      warning = networkWarning({ type: network.type, isConnected: network.isConnected });
    } catch {
      warning = "metered";
    }
    if (warning === "offline") {
      setMessage(t("recitation.offline"));
      return;
    }
    const mb = megabytes(model.bytes);
    if (warning === "metered") {
      Alert.alert(t("recitation.meteredTitle"), t("recitation.meteredBody", { mb }), [
        { text: t("recitation.cancel"), style: "cancel" },
        { text: t("recitation.meteredGo"), onPress: () => void startDownload(dev.model) },
      ]);
      return;
    }
    void startDownload(dev.model);
  };

  const confirmDelete = () =>
    Alert.alert(
      t("recitation.deleteTitle"),
      t("recitation.deleteBody", { mb: megabytes(model.bytes) }),
      [
        { text: t("recitation.cancel"), style: "cancel" },
        {
          text: t("recitation.deleteModel"),
          style: "destructive",
          onPress: () => void releaseModel().then(() => deleteModel(dev.model)),
        },
      ],
    );

  const exportChecks = async () => {
    setMessage(null);
    try {
      if (!(await shareChecks(records, t("recitation.exportTitle"))))
        setMessage(t("recitation.exportUnavailable"));
    } catch {
      setMessage(t("recitation.exportUnavailable"));
    }
  };

  const busy =
    capture.recording ||
    phase.kind === "transcribing" ||
    download.status === "downloading" ||
    download.status === "verifying";
  const fraction = downloadFraction(download);
  const percent = Math.floor((fraction ?? 0) * 100);
  const chooseModel = (id: ModelId) => {
    if (id === dev.model) return;
    void releaseModel();
    void dev.setModel(id);
  };

  return (
    <View style={styles.box}>
      <Hint>{t("recitation.hint")}</Hint>

      <Text style={[styles.label, { color: theme.muted }]}>{t("recitation.model")}</Text>
      <View>
        {MODEL_IDS.map((id) => (
          <Row
            key={id}
            label={t(`recitation.models.${id}`, { mb: megabytes(MODELS[id].bytes) })}
            selected={id === dev.model}
            disabled={busy}
            onPress={() => chooseModel(id)}
          />
        ))}
      </View>

      {download.status === "absent" ? (
        <Button
          label={t("recitation.download", { mb: megabytes(model.bytes) })}
          onPress={() => void begin()}
        />
      ) : download.status === "downloading" || download.status === "paused" ? (
        <>
          <ProgressBar fraction={fraction ?? 0} />
          <Text style={{ color: theme.text }}>
            {download.status === "downloading"
              ? t("recitation.downloading", {
                  percent,
                  done: megabytes(download.received),
                  total: megabytes(download.total),
                })
              : t("recitation.paused", { percent })}
          </Text>
          <ButtonRow>
            {download.status === "downloading" ? (
              <Button
                tone="plain"
                label={t("recitation.pause")}
                onPress={() => pauseDownload(dev.model)}
              />
            ) : (
              <Button label={t("recitation.resume")} onPress={() => void begin()} />
            )}
            <Button
              tone="plain"
              label={t("recitation.cancel")}
              onPress={() => cancelDownload(dev.model)}
            />
          </ButtonRow>
        </>
      ) : download.status === "verifying" ? (
        <>
          <ProgressBar fraction={fraction ?? 0} />
          <Text style={{ color: theme.text }}>{t("recitation.verifying", { percent })}</Text>
        </>
      ) : download.status === "failed" ? (
        <>
          <Text style={{ color: theme.danger }}>{t(`recitation.failed.${download.error}`)}</Text>
          <Button label={t("recitation.retry")} onPress={() => void begin()} />
        </>
      ) : (
        <>
          <Hint>{t("recitation.ready")}</Hint>
          {capture.recording ? (
            <>
              <Text style={{ color: theme.text, fontWeight: "600" }}>
                {t("recitation.recording", { time: formatSeconds(capture.elapsedSeconds) })}
              </Text>
              <Button label={t("recitation.stop")} onPress={capture.stop} />
            </>
          ) : phase.kind === "transcribing" ? (
            <>
              <ProgressBar fraction={phase.percent / 100} />
              <Text style={{ color: theme.text }}>
                {t("recitation.transcribing", { percent: Math.round(phase.percent) })}
              </Text>
              <Button
                tone="plain"
                label={t("recitation.cancel")}
                onPress={() => job.current?.stop()}
              />
            </>
          ) : (
            <ButtonRow>
              <Button
                label={t("recitation.start")}
                onPress={() => {
                  setMessage(null);
                  setPhase({ kind: "idle" });
                  onView(null);
                  void capture.start();
                }}
              />
              <Button tone="plain" label={t("recitation.deleteModel")} onPress={confirmDelete} />
            </ButtonRow>
          )}
        </>
      )}

      {capture.problem ? (
        <Text style={{ color: theme.muted }}>
          {t(capture.problem === "denied" ? "recitation.recordDenied" : "recitation.recordFailed")}
        </Text>
      ) : null}
      {phase.kind === "failed" ? (
        <Text style={{ color: theme.danger }}>{t("recitation.transcribeFailed")}</Text>
      ) : null}

      {phase.kind === "done" ? (
        <View style={styles.result}>
          <Text style={{ color: theme.text, fontWeight: "600" }}>
            {t("recitation.counts", { ...phase.view.counts })}
          </Text>
          {phase.view.jumps.map((j, i) => (
            <Text key={i} style={{ color: theme.danger }}>
              {t("recitation.jump", {
                at: `${j.at.surah}:${j.at.ayah}`,
                from: `${j.from.surah}:${j.from.ayah}`,
              })}
            </Text>
          ))}
          <Hint>{t("recitation.legend")}</Hint>
          <Text style={[styles.heard, { color: theme.muted }]}>
            {t("recitation.heard", { text: phase.text || "—" })}
          </Text>
          <Hint>
            {t("recitation.timing", {
              seconds: phase.seconds.toFixed(1),
              audio: phase.audio.toFixed(1),
            })}
          </Hint>
          <Button
            tone="plain"
            label={t("recitation.hide")}
            onPress={() => {
              setPhase({ kind: "idle" });
              onView(null);
            }}
          />
        </View>
      ) : null}

      {records.length > 0 ? (
        <ButtonRow>
          <Button
            tone="plain"
            label={t("recitation.export", { count: records.length })}
            onPress={() => void exportChecks()}
          />
          <Button
            tone="plain"
            label={t("recitation.clearChecks")}
            disabled={busy}
            onPress={() => {
              clearChecks();
              setRecords([]);
            }}
          />
        </ButtonRow>
      ) : null}
      {message ? <Text style={{ color: theme.muted }}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm },
  label: { fontSize: 13, fontWeight: "600" },
  result: { gap: spacing.xs },
  heard: { writingDirection: "rtl", textAlign: "right", fontSize: 16 },
});
