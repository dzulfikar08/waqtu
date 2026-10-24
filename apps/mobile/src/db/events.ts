type Listener = () => void;

const listeners = new Set<Listener>();

/** Screens re-read the database when entries or settings change (a tap, a sync, a notification action). */
export function onDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitDataChanged(): void {
  for (const listener of listeners) listener();
}
