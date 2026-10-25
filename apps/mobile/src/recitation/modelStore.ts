import { Directory, DownloadTask, File, Paths, type DownloadPauseState } from "expo-file-system";
import { useSyncExternalStore } from "react";

import { excludeFromBackup } from "../../modules/waqtu-backup";
import { downloadReducer, type DownloadEvent, type DownloadState } from "./download";
import { MODELS, type ModelId, type RecitationModel } from "./models";
import { verifySha256 } from "./verify";

/**
 * Model files in the app's private document folder (`Documents/recitation-models`), kept out of
 * iCloud and iTunes backups like the recordings: they can be downloaded again. A download goes to
 * `<file>.part` and is renamed to `<file>` only after its SHA-256 matched, so a file with the final
 * name is always a verified one. A paused download keeps its resume data in `<file>.pause.json`
 * and resumes after the app was closed.
 */
function folder(): Directory {
  return new Directory(Paths.document, "recitation-models");
}

function prepareFolder(): void {
  const dir = folder();
  dir.create({ intermediates: true, idempotent: true });
  excludeFromBackup(dir.uri);
}

export function modelFile(model: RecitationModel): File {
  return new File(folder(), model.file);
}
const partFile = (model: RecitationModel) => new File(folder(), `${model.file}.part`);
const pauseFile = (model: RecitationModel) => new File(folder(), `${model.file}.pause.json`);

interface SavedPause {
  task: DownloadPauseState;
  received: number;
  total: number;
}

function readPause(model: RecitationModel): SavedPause | null {
  try {
    const file = pauseFile(model);
    if (!file.exists) return null;
    const data: unknown = JSON.parse(file.textSync());
    if (typeof data !== "object" || data === null) return null;
    const { task, received, total } = data as Partial<SavedPause>;
    if (typeof task?.url !== "string" || task.url !== model.url) return null;
    return { task, received: Number(received) || 0, total: Number(total) || model.bytes };
  } catch {
    return null;
  }
}

function removeQuietly(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch {
    // Left-overs in the private folder are overwritten or removed with the next download.
  }
}

/** What is on disk now: a verified model, a paused download, or nothing. */
function stateOnDisk(model: RecitationModel): DownloadState {
  try {
    const file = modelFile(model);
    if (file.exists && file.size === model.bytes) return { status: "ready" };
  } catch {
    // Unreadable folder: treat as absent; a download recreates it.
  }
  const pause = readPause(model);
  return pause
    ? { status: "paused", received: pause.received, total: pause.total }
    : { status: "absent" };
}

// ---------------------------------------------------------------------------------------------
// One store per model, at module level, so a download keeps running while the user moves between
// screens.

const states = new Map<ModelId, DownloadState>();
const listeners = new Set<() => void>();
const tasks = new Map<ModelId, DownloadTask>();
const cancelled = new Set<ModelId>();

function stateOf(id: ModelId): DownloadState {
  let state = states.get(id);
  if (!state) {
    state = stateOnDisk(MODELS[id]);
    states.set(id, state);
  }
  return state;
}

function dispatch(id: ModelId, event: DownloadEvent): void {
  const before = stateOf(id);
  const after = downloadReducer(before, event, MODELS[id].bytes);
  if (after === before) return;
  states.set(id, after);
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useModelState(id: ModelId): DownloadState {
  return useSyncExternalStore(subscribe, () => stateOf(id));
}

/** Progress reports are many; the screen needs about one per 0.5% of the file. */
function progressHandler(id: ModelId) {
  let last = -Infinity;
  return ({ bytesWritten, totalBytes }: { bytesWritten: number; totalBytes: number }) => {
    const total = totalBytes > 0 ? totalBytes : MODELS[id].bytes;
    if (bytesWritten - last < total / 200 && bytesWritten < total) return;
    last = bytesWritten;
    dispatch(id, { type: "progress", received: bytesWritten, total });
  };
}

/**
 * Starts or resumes the download, then verifies the file. Resolves when the model is ready, the
 * download was paused or cancelled, or it failed (the state says which).
 */
export async function startDownload(id: ModelId): Promise<void> {
  const model = MODELS[id];
  const state = stateOf(id);
  if (state.status !== "absent" && state.status !== "failed" && state.status !== "paused") return;
  cancelled.delete(id);
  try {
    prepareFolder();
  } catch {
    dispatch(id, { type: "start" });
    dispatch(id, { type: "error", error: "storage" });
    return;
  }
  dispatch(id, { type: "start" });
  const onProgress = progressHandler(id);
  const pause = state.status === "paused" ? readPause(model) : null;
  let task: DownloadTask;
  let result: File | null;
  try {
    if (pause) {
      task = DownloadTask.fromSavable(pause.task, { onProgress });
      tasks.set(id, task);
      result = await task.resumeAsync();
    } else {
      removeQuietly(partFile(model));
      removeQuietly(pauseFile(model));
      task = File.createDownloadTask(model.url, partFile(model), {
        onProgress,
        sessionType: "foreground",
      });
      tasks.set(id, task);
      result = await task.downloadAsync();
    }
  } catch {
    tasks.delete(id);
    if (!cancelled.has(id)) dispatch(id, { type: "error", error: "network" });
    return;
  }

  if (result === null) {
    // Paused: keep the resume data so the download goes on after a restart.
    try {
      const now = stateOf(id);
      const received = now.status === "downloading" ? now.received : 0;
      pauseFile(model).write(
        JSON.stringify({ task: task.savable(), received, total: model.bytes } satisfies SavedPause),
      );
    } catch {
      // Without saved resume data the next start begins again from zero.
    }
    task.release();
    tasks.delete(id);
    dispatch(id, { type: "paused" });
    return;
  }
  task.release();
  tasks.delete(id);
  removeQuietly(pauseFile(model));
  dispatch(id, { type: "downloaded" });
  await verify(id, result);
}

async function verify(id: ModelId, part: File): Promise<void> {
  const model = MODELS[id];
  let ok: boolean | null;
  try {
    const handle = part.open();
    try {
      const size = handle.size ?? part.size;
      let offset = 0;
      ok = await verifySha256(
        (length) => {
          const n = Math.min(length, size - offset);
          if (n <= 0) return new Uint8Array(0);
          const bytes = handle.readBytes(n);
          offset += bytes.length;
          return bytes;
        },
        model.sha256,
        (checked) => dispatch(id, { type: "checked", checked }),
        () => cancelled.has(id),
      );
    } finally {
      handle.close();
    }
  } catch {
    removeQuietly(part);
    dispatch(id, { type: "error", error: "storage" });
    return;
  }
  if (ok === null) return;
  if (!ok) {
    removeQuietly(part);
    dispatch(id, { type: "mismatch" });
    return;
  }
  try {
    const target = modelFile(model);
    removeQuietly(target);
    await part.move(target);
  } catch {
    removeQuietly(part);
    dispatch(id, { type: "error", error: "storage" });
    return;
  }
  dispatch(id, { type: "verified" });
}

/** Pauses a running download; `startDownload` resumes it. */
export function pauseDownload(id: ModelId): void {
  tasks.get(id)?.pause();
}

/** Stops a running or paused download and removes what was fetched so far. */
export function cancelDownload(id: ModelId): void {
  const model = MODELS[id];
  cancelled.add(id);
  const task = tasks.get(id);
  if (task) {
    task.cancel();
    tasks.delete(id);
  }
  removeQuietly(partFile(model));
  removeQuietly(pauseFile(model));
  dispatch(id, { type: "cancelled" });
}

/** Deletes a downloaded model (release its whisper context first). */
export function deleteModel(id: ModelId): void {
  removeQuietly(modelFile(MODELS[id]));
  dispatch(id, { type: "deleted" });
}
