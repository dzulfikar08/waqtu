import { Directory, File, Paths } from "expo-file-system";

/** Recitation recordings live in the app's private document folder: never in the gallery, never uploaded. */
function folder(): Directory {
  return new Directory(Paths.document, "hafalan");
}

export function recordingUri(name: string): string {
  return new File(folder(), name).uri;
}

/** Moves a fresh recording out of the recorder's cache into the private folder; returns its file name. */
export async function keepRecording(tempUri: string, unit: number): Promise<string> {
  folder().create({ intermediates: true, idempotent: true });
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
