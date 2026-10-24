import { Directory, File, Paths } from "expo-file-system";

import { excludeFromBackup } from "../../modules/waqtu-backup";

/**
 * Recitation recordings live in the app's private document folder: never in the gallery, never
 * uploaded, and kept out of iCloud and iTunes backups (see `prepareRecordingsFolder`).
 */
function folder(): Directory {
  return new Directory(Paths.document, "hafalan");
}

/** Creates the folder if needed and marks it as excluded from backups; the mark covers every recording inside. */
function prepareRecordingsFolder(): void {
  const dir = folder();
  dir.create({ intermediates: true, idempotent: true });
  excludeFromBackup(dir.uri);
}

/**
 * Run at launch: a recordings folder made before the backup mark existed gets it now. Does nothing
 * when there are no recordings yet.
 */
export function protectExistingRecordings(): void {
  try {
    const dir = folder();
    if (dir.exists) excludeFromBackup(dir.uri);
  } catch {
    // Without the mark the recordings are merely backed up; the app must still start.
  }
}

export function recordingUri(name: string): string {
  return new File(folder(), name).uri;
}

/** Moves a fresh recording out of the recorder's cache into the private folder; returns its file name. */
export async function keepRecording(tempUri: string, unit: number): Promise<string> {
  prepareRecordingsFolder();
  const name = `unit-${unit}-${Date.now()}.m4a`;
  await new File(tempUri).move(new File(folder(), name));
  return name;
}

/** Deletes recording files. A file that is already gone, or cannot be removed, leaves nothing the app reads. */
export function removeRecordings(names: readonly (string | null)[]): void {
  for (const name of names) {
    if (name === null) continue;
    try {
      const file = new File(folder(), name);
      if (file.exists) file.delete();
    } catch {
      // The row is already gone; an orphaned file in the private folder is harmless.
    }
  }
}
