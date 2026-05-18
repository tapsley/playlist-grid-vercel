"use client";

import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { getMSTDateString } from './time';
import { createEmptyGrid, clampCellState, CellState } from './runUtils';
export { CellState };

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
  progress: Record<string, CellState[][]>;
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
          const raw = patch.progress[k] as unknown;
          if (Array.isArray(raw)) {
            next.progress[k] = deepClone((raw as unknown[]).map(row => Array.isArray(row) ? (row as unknown[]).map(n => clampCellState(n)) : []));
          } else {
            next.progress[k] = deepClone([] as CellState[][]);
          }
        }
      }

      // If user is not logged in, persist progress changes to localStorage for current date
      try {
        // Persist a local copy of progress for both anonymous and logged-in users
        // so the UI can load quickly from localStorage while server sync occurs.
        if (patch.progress) {
          const dateKey = currentDateRef.current ?? getMSTDateString();
          for (const k of Object.keys(patch.progress)) {
            const key = `picross:progress:${dateKey}:${k}`;
            try {
              const payload: any = { grid: next.progress[k] };
              try {
                const existing = window.localStorage.getItem(key);
                if (existing) {
                  const parsed = JSON.parse(existing) as { seconds?: number } | null;
                  if (parsed && typeof parsed.seconds === 'number') payload.seconds = parsed.seconds;
                }
              } catch {}
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
        const dateStr = getMSTDateString(today);
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
      const progress: Record<string, CellState[][]> = {};
      for (const k of Object.keys(progressData || {})) {
        const val = progressData[k];
        if (Array.isArray(val)) progress[k] = (val as unknown[]).map((row: unknown) => Array.isArray(row) ? (row as unknown[]).map(n => clampCellState(n)) : []);
      }

      // If the server returned per-difficulty seconds, persist them locally
      // so synchronous reads (e.g., splash/play pages) can make correct
      // decisions without awaiting an async fetch. This helps avoid wrong
      // START animation behavior when the user navigates directly after login.
      try {
        if (progressRes && progressRes.ok && typeof window !== 'undefined') {
          const dateStr = getMSTDateString();
          try {
            const easySec = typeof progressData.easySeconds === 'number' ? Number(progressData.easySeconds) || 0 : 0;
            const mediumSec = typeof progressData.mediumSeconds === 'number' ? Number(progressData.mediumSeconds) || 0 : 0;
            const hardSec = typeof progressData.hardSeconds === 'number' ? Number(progressData.hardSeconds) || 0 : 0;
            try { if (easySec > 0) window.localStorage.setItem(`picross:seconds:${dateStr}:easy`, String(easySec)); } catch {}
            try { if (mediumSec > 0) window.localStorage.setItem(`picross:seconds:${dateStr}:medium`, String(mediumSec)); } catch {}
            try { if (hardSec > 0) window.localStorage.setItem(`picross:seconds:${dateStr}:hard`, String(hardSec)); } catch {}
          } catch {}
        }
      } catch {}

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
                  progress[d] = parsed.grid.map(row => (row as number[]).map(n => clampCellState(n)));
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
    try {
      // minimal approach: check a last-loaded date saved in localStorage and
      // clear any prior progress if the date changed since last load. This
      // avoids interval timers and only resets when the app mounts or when
      // session email changes.
      const today = getMSTDateString();
      const last = window.localStorage.getItem('picross:lastLoadedDate');
      if (last !== today) {
        // clear previous-day progress so users start fresh each day
        setPrefetchState(prev => ({ puzzle: prev.puzzle, progress: {} }));
        try { window.localStorage.setItem('picross:lastLoadedDate', today); } catch {}

        // Also seed an empty server-side progress row for today for logged-in
        // users so the date exists in the DB. Only send grids — no complete
        // flags — so we never accidentally overwrite a solved state.
        if (session?.user?.email) {
          (async () => {
            try {
              const defaultEasy = createEmptyGrid(5, 0);
              const defaultMedium = createEmptyGrid(10, 0);
              const defaultHard = createEmptyGrid(15, 0);
              await fetch('/api/picross/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: today, easy: defaultEasy, medium: defaultMedium, hard: defaultHard }),
              });
            } catch (err) {
              console.debug('clear server-side progress failed', err);
            }
          })();
        }
      }
    } catch {
      // ignore localStorage errors
    }
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
