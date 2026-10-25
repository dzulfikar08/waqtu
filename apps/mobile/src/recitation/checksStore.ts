import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { excludeFromBackup } from "../../modules/waqtu-backup";
import { manifestOf, parseRecords, type CheckRecord } from "./check";

/**
 * Transcripts of the checks run on this phone, kept for the evaluation harness until exported or
 * cleared (`Documents/recitation/checks.json`, out of backups). No audio is kept: the WAV a check
 * records is deleted once transcribed.
 */
function folder(): Directory {
  return new Directory(Paths.document, "recitation");
}
const recordsFile = () => new File(folder(), "checks.json");

export function readChecks(): CheckRecord[] {
  try {
    const file = recordsFile();
    return file.exists ? parseRecords(JSON.parse(file.textSync())) : [];
  } catch {
    return [];
  }
}

export function addCheck(record: CheckRecord): CheckRecord[] {
  const records = [...readChecks().filter((r) => r.id !== record.id), record];
  const dir = folder();
  dir.create({ intermediates: true, idempotent: true });
  excludeFromBackup(dir.uri);
  recordsFile().write(JSON.stringify(records));
  return records;
}

export function clearChecks(): void {
  const file = recordsFile();
  if (file.exists) file.delete();
}

/**
 * Shares every stored check as a harness manifest (`eval:recitation`), through the system share
 * sheet. False when sharing is unavailable.
 */
export async function shareChecks(
  records: readonly CheckRecord[],
  dialogTitle: string,
): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  const stamp = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `waqtu-recitation-manifest-${stamp}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(`${JSON.stringify(manifestOf(records), null, 2)}\n`);
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/json",
    UTI: "public.json",
    dialogTitle,
  });
  return true;
}

/** A take as a WAV file in the cache, for whisper.rn; delete it with `removeTake`. */
export function writeTake(wav: Uint8Array): File {
  const file = new File(Paths.cache, "recitation-check.wav");
  if (file.exists) file.delete();
  file.create();
  file.write(wav);
  return file;
}

export function removeTake(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch {
    // The cache is the system's to clear.
  }
}
