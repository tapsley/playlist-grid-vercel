"use client";

import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";

// small safe deep clone helper — uses structuredClone when available
const deepClone = <T,>(val: T): T => {
  const maybeStructured = (globalThis as unknown as { structuredClone?: (v: unknown) => unknown }).structuredClone;
  if (typeof maybeStructured === "function") {
    return maybeStructured(val) as T;
  }
  return JSON.parse(JSON.stringify(val));
};

export type PrefetchState = {
  puzzle: Record<string, boolean[][]>;
  progress: Record<string, number[][]>;
};

export type PrefetchShape = {
  puzzle: PrefetchState["puzzle"];
  progress: PrefetchState["progress"];
  setPrefetch: (v: Partial<PrefetchState> | ((prev: PrefetchState) => Partial<PrefetchState>)) => void;
  fetchPrefetch: () => Promise<void>;
};

export const PicrossPrefetchContext = createContext<PrefetchShape>({
  puzzle: {},
  progress: {},
  setPrefetch: () => { throw new Error("usePicrossPrefetch must be used within PicrossPrefetchProvider"); },
  fetchPrefetch: async () => { throw new Error("usePicrossPrefetch must be used within PicrossPrefetchProvider"); },
});

export function PicrossPrefetchProvider({ children }: { children: React.ReactNode }) {
  const [prefetch, setPrefetchState] = useState<PrefetchState>({ puzzle: {}, progress: {} });
  const { data: session } = useSession();
  const lastEmailRef = useRef<string | null>(null);
  const currentDateRef = useRef<string | null>(null);
  const setPrefetch = useCallback((v: Partial<PrefetchState> | ((prev: PrefetchState) => Partial<PrefetchState>)) => {
    setPrefetchState(prev => {
      const patch = typeof v === "function" ? (v as (p: PrefetchState) => Partial<PrefetchState>)(deepClone(prev)) : v;
      // merge immutably, cloning arrays/objects to avoid external mutation
      const next: PrefetchState = {
        puzzle: { ...prev.puzzle },
        progress: { ...prev.progress },
      };
      if (patch.puzzle) {
        for (const k of Object.keys(patch.puzzle)) {
          next.puzzle[k] = deepClone(patch.puzzle[k] as boolean[][]);
        }
      }
      if (patch.progress) {
        for (const k of Object.keys(patch.progress)) {
          next.progress[k] = deepClone(patch.progress[k] as number[][]);
        }
      }

      // If user is not logged in, persist progress changes to localStorage for current date
      try {
        const email = session?.user?.email || null;
        if (!email && patch.progress) {
          const dateKey = currentDateRef.current ?? new Date().toISOString().slice(0, 10);
          for (const k of Object.keys(patch.progress)) {
            const key = `picross:progress:${dateKey}:${k}`;
            try {
              const payload = { grid: next.progress[k] };
              window.localStorage.setItem(key, JSON.stringify(payload));
            } catch (err) {
              // ignore localStorage failures
              console.debug('persist to localStorage failed', err);
            }
          }
        }
      } catch {
        // guards for environments without window/localStorage
      }

      return next;
    });
  }, [session?.user?.email]);

  const fetchPrefetch = useCallback(async () => {
    try {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10);
        currentDateRef.current = dateStr;
      const puzzleRes = await fetch(`/api/picross/puzzle?date=${dateStr}`);
      const progressRes = session?.user?.email ? await fetch(`/api/picross/progress?date=${dateStr}`) : null;
      const puzzleData = puzzleRes.ok ? await puzzleRes.json() : {};
      const progressData = progressRes && progressRes.ok ? await progressRes.json() : {};

      // Normalize shapes: ensure maps of arrays
      const puzzle: Record<string, boolean[][]> = {};
      for (const k of Object.keys(puzzleData || {})) {
        const val = puzzleData[k];
        if (Array.isArray(val)) puzzle[k] = val.map((row: unknown) => Array.isArray(row) ? (row as unknown[]).map(Boolean) as boolean[] : []);
      }
      const progress: Record<string, number[][]> = {};
      for (const k of Object.keys(progressData || {})) {
        const val = progressData[k];
        if (Array.isArray(val)) progress[k] = (val as unknown[]).map((row: unknown) => Array.isArray(row) ? (row as unknown[]).map(n => Number(n as unknown) || 0) : []);
      }

      // If user is not logged in, merge in any locally persisted progress for this date
      try {
        const email = session?.user?.email || null;
        if (!email) {
          for (const d of ["easy", "medium", "hard"]) {
            try {
              const key = `picross:progress:${dateStr}:${d}`;
              const raw = window.localStorage.getItem(key);
              if (raw) {
                const parsed = JSON.parse(raw) as { grid?: number[][] } | null;
                if (parsed?.grid && Array.isArray(parsed.grid)) {
                  progress[d] = parsed.grid.map(row => (row as number[]).map(n => Number(n) || 0));
                }
              }
            } catch {
              // ignore parse/localStorage errors per-key
            }
          }
        }
      } catch {
        // guard for missing window
      }

      setPrefetchState({ puzzle: deepClone(puzzle), progress: deepClone(progress) });
    } catch (err) {
      // swallow but keep a trace in dev tools
      console.debug("fetchPrefetch error", err);
    }
  }, [session?.user?.email]);

  // Fetch once when user logs in (email transitions) or if already logged in on mount
  useEffect(() => {
    // always fetch puzzles on mount and when session email changes; fetchPrefetch
    // will only attempt to fetch progress when an email exists.
    fetchPrefetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.email]);

  // Clear progress on logout so re-login always fetches user progress,
  // but keep puzzles so anonymous users still see the daily puzzle.
  useEffect(() => {
    const email = session?.user?.email || null;
    if (email) return;
    lastEmailRef.current = null;
    setPrefetchState(prev => ({ puzzle: prev.puzzle, progress: {} }));
  }, [session?.user?.email]);

  // Always expose cloned state to consumers to avoid accidental mutation
  const value = useMemo(() => ({
    puzzle: deepClone(prefetch.puzzle),
    progress: deepClone(prefetch.progress),
    setPrefetch,
    fetchPrefetch,
  }), [prefetch, setPrefetch, fetchPrefetch]);

  return (
    <PicrossPrefetchContext.Provider value={value}>
      {children}
    </PicrossPrefetchContext.Provider>
  );
}

export function usePicrossPrefetch() {
  return useContext(PicrossPrefetchContext);
}
