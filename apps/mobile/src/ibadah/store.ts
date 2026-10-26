import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";

import { getSetting } from "@/db/settings";

import { writeLocal } from "./local";

type Listener = (raw: string) => void;

/** Mounted `useLocalValue`s per key, so a change on one screen (a favourite) shows on the others (the list). */
const listeners = new Map<string, Set<Listener>>();
/** Writes per key run in order, so the last value saved is the one stored. */
const queues = new Map<string, Promise<void>>();

/**
 * One stored value: `undefined` while loading, then the parsed value. `save` updates every screen showing the key at
 * once and writes in the background. `parse` and `serialize` must be stable (module-level or memoised) functions.
 */
export function useLocalValue<T>(
  key: string,
  parse: (raw: string | null) => T,
  serialize: (value: T) => string,
): [T | undefined, (next: T) => void] {
  const db = useSQLiteContext();
  const [value, setValue] = useState<T | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setValue(undefined);
    void getSetting(db, key).then((raw) => {
      if (!cancelled) setValue(parse(raw));
    });
    const listener: Listener = (raw) => setValue(parse(raw));
    const set = listeners.get(key) ?? new Set<Listener>();
    set.add(listener);
    listeners.set(key, set);
    return () => {
      cancelled = true;
      set.delete(listener);
    };
  }, [db, key, parse]);

  const save = useCallback(
    (next: T) => {
      const text = serialize(next);
      for (const listener of listeners.get(key) ?? []) listener(text);
      const previous = queues.get(key) ?? Promise.resolve();
      queues.set(
        key,
        previous.then(() => writeLocal(db, key, text)).catch(() => {}),
      );
    },
    [db, key, serialize],
  );

  return [value, save];
}
