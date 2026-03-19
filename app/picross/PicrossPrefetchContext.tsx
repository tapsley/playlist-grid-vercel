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
      return next;
    });
  }, []);

  const fetchPrefetch = useCallback(async () => {
    try {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10);
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

      setPrefetchState({ puzzle: deepClone(puzzle), progress: deepClone(progress) });
    } catch (err) {
      // swallow but keep a trace in dev tools
      console.debug("fetchPrefetch error", err);
    }
  }, [session?.user?.email]);

  // Fetch once when user logs in (email transitions) or if already logged in on mount
  useEffect(() => {
    const email = session?.user?.email || null;
    if (!email) return;
    if (lastEmailRef.current === email) return;
    lastEmailRef.current = email;
    fetchPrefetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.email]);

  // Clear prefetch on logout so re-login always triggers a fresh fetch
  useEffect(() => {
    const email = session?.user?.email || null;
    if (email) return;
    lastEmailRef.current = null;
    setPrefetchState({ puzzle: {}, progress: {} });
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
