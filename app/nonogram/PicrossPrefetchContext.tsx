"use client";

import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { getMSTDateString } from './time';
import { createEmptyGrid, clampCellState, CellState } from './runUtils';
import { storageKeys } from './storageKeys';
export { CellState };

// small safe deep clone helper — uses structuredClone when available
const deepClone = <T,>(val: T): T => {
  const maybeStructured = (globalThis as unknown as { structuredClone?: (v: unknown) => unknown }).structuredClone;
  if (typeof maybeStructured === "function") {
    return maybeStructured(val) as T;
  }
  return JSON.parse(JSON.stringify(val));
};

/** Normalize a raw API progress payload into a typed CellState grid map. */
function normalizeProgress(raw: Record<string, unknown>): Record<string, CellState[][]> {
  const result: Record<string, CellState[][]> = {};
  for (const k of Object.keys(raw)) {
    const val = raw[k];
    if (Array.isArray(val)) {
      result[k] = (val as unknown[]).map(row =>
        Array.isArray(row) ? (row as unknown[]).map(n => clampCellState(n)) : []
      );
    }
  }
  return result;
}

/** Persist elapsed-seconds values from a progress API response to localStorage. */
function persistSecondsToStorage(dateStr: string, progressData: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const pairs: Array<[string, unknown]> = [
    [storageKeys.seconds(dateStr, 'easy'),   progressData.easySeconds],
    [storageKeys.seconds(dateStr, 'medium'), progressData.mediumSeconds],
    [storageKeys.seconds(dateStr, 'hard'),   progressData.hardSeconds],
  ];
  for (const [key, raw] of pairs) {
    const sec = typeof raw === 'number' ? Number(raw) || 0 : 0;
    try { if (sec > 0) window.localStorage.setItem(key, String(sec)); } catch {}
  }
}

/** For anonymous users: overwrite progress entries from localStorage for this date. */
function mergeAnonymousProgress(dateStr: string, progress: Record<string, CellState[][]>): void {
  for (const d of ['easy', 'medium', 'hard']) {
    try {
      const raw = window.localStorage.getItem(storageKeys.progress(dateStr, d));
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { grid?: number[][] } | null;
      if (parsed?.grid && Array.isArray(parsed.grid)) {
        progress[d] = parsed.grid.map(row => (row as number[]).map(n => clampCellState(n)));
      }
    } catch {
      // ignore per-key parse/localStorage errors
    }
  }
}

/**
 * On first login, POST any locally-completed puzzles to the server so stats
 * are recorded without the user having to re-open each solved puzzle.
 */
async function syncLocalCompletionsToServer(dateStr: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const diffs = ['easy', 'medium', 'hard'] as const;

  // Capture localStorage SYNCHRONOUSLY before any await so concurrent effects
  // (e.g. the splash page's anonymous-session cleanup) cannot race and delete
  // the data between now and when we would have read it after an async fetch.
  type LocalEntry = { grid: number[][]; seconds: number };
  const localData: Partial<Record<string, LocalEntry>> = {};
  for (const d of diffs) {
    try {
      const raw = window.localStorage.getItem(storageKeys.progress(dateStr, d));
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { grid?: number[][]; complete?: boolean; seconds?: number } | null;
      if (!parsed?.complete || !Array.isArray(parsed.grid)) continue;
      const seconds = typeof parsed.seconds === 'number' && parsed.seconds > 0
        ? parsed.seconds
        : (() => {
            try { return Number(window.localStorage.getItem(storageKeys.seconds(dateStr, d))) || 0; } catch { return 0; }
          })();
      localData[d] = { grid: parsed.grid as number[][], seconds };
    } catch { /* ignore per-difficulty errors */ }
  }

  // Nothing locally completed — nothing to sync
  if (Object.keys(localData).length === 0) return;

  // Fetch what the server already has so we don't overwrite an existing solve
  let serverProgress: Record<string, unknown> = {};
  try {
    const res = await fetch(`/api/picross/progress?date=${dateStr}`);
    if (res.ok) serverProgress = await res.json() ?? {};
  } catch { /* ignore — treat as nothing on server */ }

  const body: Record<string, unknown> = { date: dateStr };
  let anyComplete = false;

  for (const d of diffs) {
    // Skip if the server already has this difficulty marked complete
    if (serverProgress[`${d}Complete`] === true) continue;
    const entry = localData[d];
    if (!entry) continue;
    anyComplete = true;
    body[d] = entry.grid;
    body[`${d}Complete`] = true;
    if (entry.seconds > 0) body[`${d}Seconds`] = entry.seconds;
  }

  if (!anyComplete) return;
  await fetch('/api/picross/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Persist a single difficulty's progress grid to localStorage, preserving any stored seconds. */
function persistProgressToStorage(dateKey: string, difficulty: string, grid: CellState[][]): void {
  const key = storageKeys.progress(dateKey, difficulty);
  try {
    const payload: { grid: CellState[][]; seconds?: number } = { grid };
    try {
      const existing = window.localStorage.getItem(key);
      if (existing) {
        const parsed = JSON.parse(existing) as { seconds?: number } | null;
        if (parsed && typeof parsed.seconds === 'number') payload.seconds = parsed.seconds;
      }
    } catch {}
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    console.debug('persist to localStorage failed', err);
  }
}

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
          next.progress[k] = Array.isArray(raw)
            ? deepClone((raw as unknown[]).map(row => Array.isArray(row) ? (row as unknown[]).map(n => clampCellState(n)) : []))
            : deepClone([] as CellState[][]);
        }
        try {
          const dateKey = currentDateRef.current ?? getMSTDateString();
          for (const k of Object.keys(patch.progress)) {
            persistProgressToStorage(dateKey, k, next.progress[k]);
          }
        } catch {
          // guard for environments without window/localStorage
        }
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

      const puzzle: Record<string, boolean[][]> = {};
      for (const k of Object.keys(puzzleData || {})) {
        const val = puzzleData[k];
        if (Array.isArray(val)) puzzle[k] = val.map((row: unknown) => Array.isArray(row) ? (row as unknown[]).map(Boolean) as boolean[] : []);
      }
      const progress = normalizeProgress(progressData);

      if (progressRes?.ok) persistSecondsToStorage(dateStr, progressData);
      if (!session?.user?.email) mergeAnonymousProgress(dateStr, progress);

      setPrefetchState({ puzzle: deepClone(puzzle), progress: deepClone(progress) });
    } catch (err) {
      console.debug('fetchPrefetch error', err);
    }
  }, [session?.user?.email]);

  // Fetch once when user logs in (email transitions) or if already logged in on mount
  useEffect(() => {
    const email = session?.user?.email ?? null;
    // Detect anonymous → authenticated transition so we can sync any locally-completed
    // puzzles to the server before refreshing from it.
    const loginTransition = lastEmailRef.current === null && email !== null;
    lastEmailRef.current = email;

    // always fetch puzzles on mount and when session email changes; fetchPrefetch
    // will only attempt to fetch progress when an email exists.
    try {
      // minimal approach: check a last-loaded date saved in localStorage and
      // clear any prior progress if the date changed since last load. This
      // avoids interval timers and only resets when the app mounts or when
      // session email changes.
      const today = getMSTDateString();
      const last = window.localStorage.getItem(storageKeys.lastLoaded());
      if (last !== today) {
        // clear previous-day progress so users start fresh each day
        setPrefetchState(prev => ({ puzzle: prev.puzzle, progress: {} }));
        try { window.localStorage.setItem(storageKeys.lastLoaded(), today); } catch {}

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

    if (loginTransition) {
      // Sync before fetching so the server has the completed state when fetchPrefetch runs
      const today = getMSTDateString();
      syncLocalCompletionsToServer(today)
        .catch(err => console.debug('syncLocalCompletions failed', err))
        .finally(() => { fetchPrefetch(); });
    } else {
      fetchPrefetch();
    }
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
