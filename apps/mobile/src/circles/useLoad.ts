import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

export interface Loaded<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: () => Promise<void>;
  /** Replaces the data locally (after an optimistic change) without refetching. */
  set: (next: T | null) => void;
}

/** Runs `load` whenever the screen gains focus, so a tab or a pushed screen is never stale. */
export function useLoad<T>(load: () => Promise<T>): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const loader = useRef(load);
  loader.current = load;
  const run = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++run.current;
    setLoading(true);
    try {
      const next = await loader.current();
      if (run.current !== mine) return;
      setData(next);
      setError(null);
    } catch (e) {
      if (run.current !== mine) return;
      setError(e);
    } finally {
      if (run.current === mine) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
      return () => {
        run.current++;
      };
    }, [reload]),
  );

  return { data, error, loading, reload, set: setData };
}
