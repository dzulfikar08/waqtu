import { Directory, File, Paths } from "expo-file-system";

import { excludeFromBackup } from "../../modules/waqtu-backup";

/**
 * Voice reflections live in the app's private document folder, like hafalan recordings: never in
 * the gallery, kept out of iCloud and iTunes backups, and uploaded only when the user shares one
 * to a circle.
 */
function folder(): Directory {
  return new Directory(Paths.document, "halaqah");
}

export function reflectionVoiceUri(name: string): string {
  return new File(folder(), name).uri;
}

/** Moves a fresh recording out of the recorder's cache into the private folder; returns its file name. */
export async function keepReflectionVoice(tempUri: string, day: number): Promise<string> {
  const dir = folder();
  dir.create({ intermediates: true, idempotent: true });
  excludeFromBackup(dir.uri);
  const name = `day-${day}-${Date.now()}.m4a`;
  await new File(tempUri).move(new File(dir, name));
  return name;
}

/** Deletes a recording file. A file that is already gone, or cannot be removed, leaves nothing the app reads. */
export function removeReflectionVoice(name: string | null): void {
  if (name === null) return;
  try {
    const file = new File(folder(), name);
    if (file.exists) file.delete();
  } catch {
    // The row is already gone; an orphaned file in the private folder is harmless.
  }
}
