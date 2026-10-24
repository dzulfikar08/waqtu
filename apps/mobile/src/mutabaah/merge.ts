/**
 * Last-write-wins rules shared with services/api: the greater `updatedAt` wins; on an equal
 * timestamp the greater value wins, so every replica converges whatever the arrival order.
 */
export interface SyncEntry {
  date: string;
  itemId: string;
  value: number;
  updatedAt: number;
}

export interface SyncSetting {
  key: string;
  value: string;
  updatedAt: number;
}

/** True when `incoming` should replace `current` (undefined = no row yet). Identical rows do not replace. */
export function entryWins(incoming: SyncEntry, current: SyncEntry | undefined): boolean {
  if (!current) return true;
  if (incoming.updatedAt !== current.updatedAt) return incoming.updatedAt > current.updatedAt;
  return incoming.value > current.value;
}

export function settingWins(incoming: SyncSetting, current: SyncSetting | undefined): boolean {
  if (!current) return true;
  if (incoming.updatedAt !== current.updatedAt) return incoming.updatedAt > current.updatedAt;
  return incoming.value > current.value;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
