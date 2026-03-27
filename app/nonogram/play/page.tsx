// Moved PicrossPage implementation here from page.tsx
"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import type { PrefetchShape } from "../PicrossPrefetchContext";
import type { CellState } from "../PicrossPrefetchContext";
import { usePicrossPrefetch } from "../PicrossPrefetchContext";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const DIFFICULTY_CONFIG: Record<string, { size: number }> = {
  easy: { size: 5 },
  medium: { size: 10 },
  hard: { size: 15 },
};

function getDefaultPuzzle(size: number): boolean[][] {
  return Array(size).fill(0).map(() => Array(size).fill(false));
}


function getClues(puzzle: boolean[][]) {
  const rows = puzzle.map(row => {
    const clues = [];
    let count = 0;
    for (const cell of row) {
      if (cell) count++;
      else if (count) { clues.push(count); count = 0; }
    }
    if (count) clues.push(count);
    return clues.length ? clues : [0];
  });
  const cols = [];
  for (let c = 0; c < puzzle[0].length; c++) {
    const clues = [] as number[];
    let count = 0;
    for (let r = 0; r < puzzle.length; r++) {
      if (puzzle[r][c]) count++;
      else if (count) { clues.push(count); count = 0; }
    }
    if (count) clues.push(count);
    cols.push(clues.length ? clues : [0]);
  }
  return { rows, cols };
}

function PicrossPlayInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const difficulty = searchParams.get("difficulty") || "easy";
  const size = DIFFICULTY_CONFIG[difficulty]?.size || 5;
  const { puzzle: prefetchPuzzle, progress: prefetchProgress, setPrefetch } = usePicrossPrefetch() as PrefetchShape;
  // Editor-only local puzzle state; main puzzle/progress live in provider
  const [editorMode, setEditorMode] = useState(false);
  const [editorPuzzle, setEditorPuzzle] = useState<boolean[][] | null>(null);
  const findNextAbort = useRef<AbortController | null>(null);
  const [inputMode, setInputMode] = useState<"fill" | "maybe" | "x">("fill");
  const pointerActiveRef = useRef(false);
  const pointerActionRef = useRef<"fill" | "erase" | "fillX" | "fillMaybe" | "eraseMaybe" | null>(null);
  const [hoveredMode, setHoveredMode] = useState<"fill" | "maybe" | "x" | null>(null);

  const puzzle = editorMode
    ? (editorPuzzle ?? (prefetchPuzzle && prefetchPuzzle[difficulty]) ?? getDefaultPuzzle(size))
    : (prefetchPuzzle && prefetchPuzzle[difficulty]) ?? getDefaultPuzzle(size);

  const { rows: rowClues, cols: colClues } = useMemo(() => getClues(puzzle), [puzzle]);

  const { data: session } = useSession();

  const isPuzzleEmpty = (p: unknown): boolean => {
    if (!Array.isArray(p)) return true;
    try {
      for (const row of p as unknown[]) {
        if (Array.isArray(row)) {
          for (const cell of row) {
            if (cell) return false;
          }
        }
      }
    } catch {
      return true;
    }
    return true;
  };

  const baseBtnStyle: React.CSSProperties = { padding: '6px 10px', fontSize: 14, borderRadius: 6, border: '1px solid #aaa', background: '#f8f8f8', cursor: 'pointer' };
  const primaryBtnStyle: React.CSSProperties = { ...baseBtnStyle, background: '#2b6cb0', color: '#fff', border: '1px solid #2b6cb0' };
  const dangerBtnStyle: React.CSSProperties = { ...baseBtnStyle, background: '#fff', color: '#c53030', border: '1px solid #c53030' };
  const hoverBtnStyle: React.CSSProperties = { boxShadow: '0 2px 6px rgba(0,0,0,0.12)' };
  const selectedBtnStyle: React.CSSProperties = { background: '#3182ce', color: '#fff', border: '1px solid #2b6cb0' };

  // Get today's date in YYYY-MM-DD
  const dateStr = new Date().toISOString().slice(0, 10);
  const formattedDate = new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

  // Layout constants: responsive cell size so the full grid can fit on small devices
  const BASE_LEFT_PX = 0; // base left/top clue area (px)
  const [cellPx, setCellPx] = useState<number>(0);
  const CLUE_FONT_PX = Math.max(12, Math.round(cellPx * 0.45));
  const DEFAULT_FONT = '"Courier New", monospace';

  // fixed gap sizes per difficulty for clue number spacing
  const GAP_SIZES: Record<string, number> = { easy: 15, medium: 11, hard: 7 };
  const clueGap = GAP_SIZES[difficulty] ?? 11;

  // Fixed clue-area sizes per difficulty: keep three tunable values only.
  const CLUE_AREA_SIZES: Record<string, { left: number; top: number }> = {
    easy: { left: 90, top: 90 },
    medium: { left: 100, top: 100 },
    hard: { left: 125, top: 125 },
  };
  const { left: leftWidth, top: topHeight } = CLUE_AREA_SIZES[difficulty] ?? CLUE_AREA_SIZES.medium;

  // Divider styling: easy to change color/width for the mid-grid highlight
  const DIVIDER_COLOR = '#00eb27';

  // Use email as identifier for session
  const userIsLoggedIn = !!session?.user?.email;

  const grid: CellState[][] = useMemo(() => {
    if (prefetchProgress && prefetchProgress[difficulty]) {
      return (prefetchProgress[difficulty] as CellState[][]).map((row: CellState[]) => row.map(n => (Math.max(0, Math.min(3, Math.trunc(Number(n as unknown) || 0))) as CellState)));
    }
    // if not logged in, check localStorage for saved progress for today's date
    if (!userIsLoggedIn) {
      try {
        const key = `picross:progress:${dateStr}:${difficulty}`;
        const raw = window.localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as { grid?: number[][] } | null;
          if (parsed?.grid && Array.isArray(parsed.grid)) {
            return (parsed.grid as number[][]).map(row => row.map(n => n as CellState));
          }
        }
      } catch (err) {
        console.debug('localStorage read error', err);
      }
    }
    return Array.from({ length: size }, () => Array.from({ length: size }, () => 0 as CellState));
  }, [prefetchProgress, difficulty, size, dateStr, userIsLoggedIn]);

  const cleared = useMemo(() => {
    if (editorMode) return false;
    let win = true;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (puzzle[r][c] && grid[r][c] !== 1) win = false;
        if (!puzzle[r][c] && grid[r][c] === 1) win = false;
      }
    }
    return win;
  }, [grid, puzzle, size, editorMode]);
  const [celebrateGrid, setCelebrateGrid] = useState<boolean[][] | null>(null);
  const celebrationTimeouts = useRef<number[]>([]);

  // Timer state: track cumulative seconds for this date+difficulty and whether timer is running
  // Initialize from localStorage synchronously so the UI doesn't flash 00:00.
  const [elapsedSec, setElapsedSec] = useState<number>(() => {
    try {
      if (typeof window === 'undefined') return 0;
      const key = `picross:seconds:${dateStr}:${difficulty}`;
      const raw = window.localStorage.getItem(key);
      if (raw) return Number(raw) || 0;
      const pKey = `picross:progress:${dateStr}:${difficulty}`;
      const pRaw = window.localStorage.getItem(pKey);
      if (pRaw) {
        const parsed = JSON.parse(pRaw) as { seconds?: number } | null;
        const sec = Number(parsed?.seconds ?? 0) || 0;
        if (sec) return sec;
      }
    } catch {
      // ignore
    }
    return 0;
  });
  const timerRef = useRef<number | null>(null);
  const saveTimerDebounce = useRef<number | null>(null);

  const formatSec = (s: number) => {
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = Math.floor(s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  // Load initial seconds for this date/difficulty (server or localStorage)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (userIsLoggedIn) {
          const res = await fetch(`/api/picross/progress?date=${dateStr}`);
          if (res.ok) {
            const json = await res.json();
            // progress row may include easySeconds / mediumSeconds / hardSeconds
            const secKey = difficulty === 'easy' ? 'easySeconds' : difficulty === 'medium' ? 'mediumSeconds' : 'hardSeconds';
            const val = Number(json?.[secKey] ?? 0) || 0;
            if (mounted) setElapsedSec(val);
          }
        } else {
          try {
            const key = `picross:seconds:${dateStr}:${difficulty}`;
            const raw = window.localStorage.getItem(key);
            if (raw) {
              const n = Number(raw) || 0;
              if (mounted) setElapsedSec(n);
            } else {
              // Also check for seconds stored alongside progress payload
              try {
                const pKey = `picross:progress:${dateStr}:${difficulty}`;
                const pRaw = window.localStorage.getItem(pKey);
                if (pRaw) {
                  console.debug('picross:found progress payload while loading seconds', pKey, pRaw);
                  const parsed = JSON.parse(pRaw) as { grid?: number[][]; seconds?: number } | null;
                  const sec = Number(parsed?.seconds ?? 0) || 0;
                  console.debug('picross:loaded seconds from progress payload', pKey, sec, parsed?.seconds);
                  if (sec && mounted) setElapsedSec(sec);
                }
              } catch {}
            }
          } catch {}
        }
      } catch (err) {
        console.debug('load seconds err', err);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, dateStr, userIsLoggedIn]);

  // Start timer on mount (and resume) unless puzzle already cleared or in editorMode
  useEffect(() => {
    if (editorMode) return;
    if (cleared) return;
    if (timerRef.current) return;
    timerRef.current = window.setInterval(() => setElapsedSec(s => s + 1) as unknown as number, 1000) as unknown as number;
    return () => {
      if (timerRef.current) { window.clearInterval(timerRef.current as unknown as number); timerRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorMode, cleared]);

  // Persist seconds periodically and on unmount
  useEffect(() => {
    // debounce save every 5s
    if (saveTimerDebounce.current) clearTimeout(saveTimerDebounce.current);
    saveTimerDebounce.current = window.setTimeout(async () => {
      try {
        // Persist seconds periodically for logged-in users (server), and
        // also write a local copy for quick performance.
        if (userIsLoggedIn) {
          const body: any = { date: dateStr };
          if (difficulty === 'easy') body.easySeconds = elapsedSec;
          if (difficulty === 'medium') body.mediumSeconds = elapsedSec;
          if (difficulty === 'hard') body.hardSeconds = elapsedSec;
          try {
            await fetch('/api/picross/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          } catch (err) {
            console.debug('picross:periodic server save failed', err);
          }
          try {
            const key = `picross:seconds:${dateStr}:${difficulty}`;
            window.localStorage.setItem(key, String(elapsedSec));
            const pKey = `picross:progress:${dateStr}:${difficulty}`;
            const payload = { grid, complete: cleared, seconds: elapsedSec };
            window.localStorage.setItem(pKey, JSON.stringify(payload));
          } catch (err) {
            console.debug('picross:periodic local save err', err);
          }
        }
      } catch (err) {
        console.debug('save seconds err', err);
      }
    }, 5000) as unknown as number;
    return () => { if (saveTimerDebounce.current) clearTimeout(saveTimerDebounce.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSec, difficulty, dateStr, userIsLoggedIn]);

  // Save immediately (used on visibilitychange/unload) to avoid losing recent seconds
  const saveSecondsNow = async () => {
    try {
      if (userIsLoggedIn) {
        const body: any = { date: dateStr };
        if (difficulty === 'easy') body.easySeconds = elapsedSec;
        if (difficulty === 'medium') body.mediumSeconds = elapsedSec;
        if (difficulty === 'hard') body.hardSeconds = elapsedSec;
        // don't await too long; fire-and-forget but attempt to complete
        try {
          await fetch('/api/picross/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        } catch (err) {
          console.debug('picross:saveSecondsNow server POST failed', err);
        }
        // Also persist locally for fast reload
        try {
          const key = `picross:seconds:${dateStr}:${difficulty}`;
          window.localStorage.setItem(key, String(elapsedSec));
          const pKey = `picross:progress:${dateStr}:${difficulty}`;
          const payload = { grid, complete: cleared, seconds: elapsedSec };
          window.localStorage.setItem(pKey, JSON.stringify(payload));
        } catch (err) {
          console.debug('picross:saveSecondsNow local save err', err);
        }
      } else {
        try {
          const key = `picross:seconds:${dateStr}:${difficulty}`;
          console.debug('picross:save seconds now (anonymous)', key, elapsedSec);
          window.localStorage.setItem(key, String(elapsedSec));
          // Also persist the current progress payload for anonymous users
          try {
            const pKey = `picross:progress:${dateStr}:${difficulty}`;
            const existing = window.localStorage.getItem(pKey);
            const payload: any = { grid, complete: cleared, seconds: elapsedSec };
            if (existing) {
              try {
                const parsed = JSON.parse(existing) as any;
                if (parsed?.grid) payload.grid = parsed.grid;
              } catch {}
            }
            console.debug('picross:save progress payload (anonymous)', pKey, payload);
            window.localStorage.setItem(pKey, JSON.stringify(payload));
          } catch (err) {
            console.debug('picross:save progress payload err', err);
          }
        } catch (err) {
          console.debug('picross:save seconds now err', err);
        }
      }
    } catch (err) {
      console.debug('save seconds now err', err);
    }
  };

  // Persist on visibilitychange / beforeunload so seconds aren't lost when navigating away
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) saveSecondsNow();
    };
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only attempt async save for logged-in users on unload. Anonymous
      // seconds are saved explicitly on Back click or on puzzle completion.
      if (userIsLoggedIn) {
        // fire-and-forget
        saveSecondsNow();
      }
      // allow unload
      delete e.returnValue;
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSec, difficulty, dateStr, userIsLoggedIn]);

  // When puzzle is cleared, stop timer and send final time + complete flag to server (so fastest can update)
  useEffect(() => {
    if (!cleared) return;
    // stop timer
    if (timerRef.current) { window.clearInterval(timerRef.current as unknown as number); timerRef.current = null; }
    (async () => {
      try {
        if (userIsLoggedIn) {
          const body: any = { date: dateStr };
          if (difficulty === 'easy') { body.easySeconds = elapsedSec; body.easyComplete = true; }
          if (difficulty === 'medium') { body.mediumSeconds = elapsedSec; body.mediumComplete = true; }
          if (difficulty === 'hard') { body.hardSeconds = elapsedSec; body.hardComplete = true; }
          try {
            await fetch('/api/picross/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          } catch (err) {
            console.debug('picross:final server save failed', err);
          }
          try {
            const key = `picross:seconds:${dateStr}:${difficulty}`;
            window.localStorage.setItem(key, String(elapsedSec));
            const pKey = `picross:progress:${dateStr}:${difficulty}`;
            const payload: any = { grid, complete: true, seconds: elapsedSec };
            window.localStorage.setItem(pKey, JSON.stringify(payload));
          } catch (err) {
            console.debug('picross:final local save err', err);
          }
        } else {
          try {
            const key = `picross:seconds:${dateStr}:${difficulty}`;
            window.localStorage.setItem(key, String(elapsedSec));
            // Also persist into progress payload so completion is visible in UI
            try {
              const pKey = `picross:progress:${dateStr}:${difficulty}`;
              const existing = window.localStorage.getItem(pKey);
              const payload: any = { grid, complete: true, seconds: elapsedSec };
              if (!payload.grid && existing) {
                try { const parsed = JSON.parse(existing) as any; if (parsed?.grid) payload.grid = parsed.grid; } catch {}
              }
              window.localStorage.setItem(pKey, JSON.stringify(payload));
            } catch (err) {
              console.debug('picross:final save progress payload err', err);
            }
          } catch (err) {
            console.debug('picross:final save seconds err', err);
          }
        }
      } catch (err) {
        console.debug('final save seconds err', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleared]);

  // Run celebration when `cleared` transitions to true or when user returns (no active celebrateGrid).
  useEffect(() => {
    if (!cleared) {
      // reset and clear pending timeouts only when puzzle is not cleared
      setCelebrateGrid(null);
      for (const t of celebrationTimeouts.current) window.clearTimeout(t);
      celebrationTimeouts.current = [];
      return;
    }

    if (cleared && !celebrateGrid) {
      // Clear Maybe/X marks in provider before animating (doesn't affect filled cells)
      try {
        setPrefetch(prev => {
          const cur = (prev.progress && prev.progress[difficulty]) ?? Array.from({ length: size }, () => Array.from({ length: size }, () => 0 as CellState));
          const next: CellState[][] = cur.map((row: CellState[]) => row.map(v => (v === 2 || v === 3) ? 0 : v));
          return {
            ...prev,
            progress: {
              ...prev.progress,
              [difficulty]: next,
            },
          };
        });
      } catch (err) {
        console.debug('clear maybe/x before celebration failed', err);
      }

      // collect filled cells (only those that should be filled in puzzle)
      const filled: Array<[number, number]> = [];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (puzzle[r][c] && grid[r][c] === 1) filled.push([r, c]);
        }
      }

      const init = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
      setCelebrateGrid(init);

      const delay = 60;
      filled.forEach(([r, c], i) => {
        const t = window.setTimeout(() => {
          setCelebrateGrid(prev => {
            if (!prev) return prev;
            const next = prev.map(row => row.slice());
            next[r][c] = true;
            return next;
          });
        }, i * delay);
        celebrationTimeouts.current.push(t as unknown as number);
      });

      // cleanup only runs when cleared becomes false or component unmounts
      return () => {
        // don't clear timeouts here since we want the animation to finish unless cleared becomes false
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleared]);
  const [saveDate, setSaveDate] = useState("");

  const handleCellClick = (r: number, c: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (cleared) return;
    if (editorMode) {
      // initialize editorPuzzle from provider if needed
      setEditorPuzzle(prev => {
        const base = prev ?? ((prefetchPuzzle && prefetchPuzzle[difficulty]) ?? getDefaultPuzzle(size));
        const next = base.map(row => [...row]);
        if (e.button === 0) next[r][c] = !next[r][c];
        return next;
      });
      return;
    }

    // Fallback click behavior: toggle through states when pointer events aren't available
    setPrefetch(prev => {
      const current = (prev.progress && prev.progress[difficulty]) ?? Array.from({ length: size }, () => Array.from({ length: size }, () => 0 as CellState));
      const next: CellState[][] = current.map((row: CellState[]) => row.map(v => (Math.max(0, Math.min(3, Math.trunc(Number(v as unknown) || 0))) as CellState)));
      const val = next[r][c] as number;
      let newVal: CellState = 0;
      // Treat right-click as X mode on desktop regardless of selected inputMode
      if ((e as any).button === 2) {
        newVal = (val === 3 ? 0 : 3) as CellState;
      } else if (inputMode === 'fill') {
        // clicking an X while in fill mode should make it blank (erase), not fill it
        if (val === 3) newVal = 0;
        else newVal = ((val + 1) % 4) as CellState;
      } else if (inputMode === 'maybe') newVal = (val === 2 ? 0 : 2) as CellState;
      else newVal = (val === 3 ? 0 : 3) as CellState;
      next[r][c] = newVal as CellState;
      return {
        ...prev,
        progress: {
          ...prev.progress,
          [difficulty]: next,
        },
      };
    });
  };

  // Apply action to a specific cell (used by pointer drag)
  const applyActionToCell = (r: number, c: number, action: "fill" | "erase" | "fillX" | "fillMaybe" | "eraseMaybe") => {
    if (editorMode) return;
    if (cleared) return;
    setPrefetch(prev => {
      const cur = (prev.progress && prev.progress[difficulty]) ?? Array.from({ length: size }, () => Array.from({ length: size }, () => 0 as CellState));
      const next: CellState[][] = cur.map((row: CellState[]) => row.map(v => (Math.max(0, Math.min(3, Math.trunc(Number(v as unknown) || 0))) as CellState)));
      const currentVal = next[r][c] as number;
      if (action === "fill") {
        // Fill: set to filled (1). Do NOT overwrite X (3) marks while dragging.
        if (currentVal === 1) return prev;
        if (currentVal === 3) {
          // keep Xs untouched during fill drags
          return prev;
        }
        next[r][c] = 1;
      } else if (action === "erase") {
        // Erase everything to empty
        if (currentVal === 0) return prev;
        next[r][c] = 0;
      } else if (action === "fillX") {
        // X mode: set X (3). Do not replace filled (1).
        if (currentVal === 1) return prev;
        if (currentVal === 3) return prev;
        next[r][c] = 3;
      } else if (action === "fillMaybe") {
        // Maybe mode: only set maybe (2) on empty cells; do not replace filled (1) or X (3)
        if (currentVal === 1 || currentVal === 3) return prev;
        if (currentVal === 2) return prev;
        next[r][c] = 2;
      } else if (action === "eraseMaybe") {
        // Erase only maybe marks
        if (currentVal !== 2) return prev;
        next[r][c] = 0;
      }
      return {
        ...prev,
        progress: {
          ...prev.progress,
          [difficulty]: next,
        },
      };
    });
  };

  // Pointer lifecycle handlers
  useEffect(() => {
    const onPointerUp = () => {
      pointerActiveRef.current = false;
      pointerActionRef.current = null;
    };
    window.addEventListener("pointerup", onPointerUp);
    return () => window.removeEventListener("pointerup", onPointerUp);
  }, []);

  const handleSave = () => {
    if (!saveDate || !editorPuzzle) return;
    (async () => {
      try {
        const res = await fetch("/api/picross/puzzle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: saveDate, difficulty, puzzle: editorPuzzle }),
        });
        if (res.ok || res.status === 201 || res.status === 204) {
          // update provider so UI reflects new puzzle immediately
          setPrefetch(prev => ({
            ...prev,
            puzzle: {
              ...prev.puzzle,
              [difficulty]: editorPuzzle,
            },
          }));
          alert(`Saved puzzle for ${saveDate} (${difficulty})`);
        } else {
          const text = await res.text();
          alert(`Save failed: ${res.status} ${text}`);
        }
      } catch (err) {
        console.error(err);
        alert(`Save error`);
      }
    })();
  };

  const handleNextDate = async () => {
    // advance saveDate by one day and load puzzle (or blank) for that date
    const base = saveDate || new Date().toISOString().slice(0, 10);
    const d = new Date(base);
    d.setDate(d.getDate() + 1);
    const ds = d.toISOString().slice(0, 10);
    try {
      const res = await fetch(`/api/picross/puzzle?date=${ds}`);
      if (res.status === 404) {
        setEditorPuzzle(getDefaultPuzzle(size));
      } else if (res.ok) {
        const json = await res.json();
        const entry = json?.[difficulty];
        if (isPuzzleEmpty(entry)) {
          setEditorPuzzle(getDefaultPuzzle(size));
        } else if (Array.isArray(entry)) {
          setEditorPuzzle(entry as boolean[][]);
        } else {
          setEditorPuzzle(getDefaultPuzzle(size));
        }
      } else {
        console.debug('next date load failed', res.status);
        setEditorPuzzle(getDefaultPuzzle(size));
      }
    } catch (err) {
      console.debug('next date fetch error', err);
      setEditorPuzzle(getDefaultPuzzle(size));
    }
    setSaveDate(ds);
  };

  const handlePrevDate = async () => {
    // move saveDate back by one day and load puzzle for that date
    const base = saveDate || new Date().toISOString().slice(0, 10);
    const d = new Date(base);
    d.setDate(d.getDate() - 1);
    const ds = d.toISOString().slice(0, 10);
    try {
      const res = await fetch(`/api/picross/puzzle?date=${ds}`);
      if (res.status === 404) {
        setEditorPuzzle(getDefaultPuzzle(size));
      } else if (res.ok) {
        const json = await res.json();
        const entry = json?.[difficulty];
        if (isPuzzleEmpty(entry)) {
          setEditorPuzzle(getDefaultPuzzle(size));
        } else if (Array.isArray(entry)) {
          setEditorPuzzle(entry as boolean[][]);
        } else {
          setEditorPuzzle(getDefaultPuzzle(size));
        }
      } else {
        console.debug('prev date load failed', res.status);
        setEditorPuzzle(getDefaultPuzzle(size));
      }
    } catch (err) {
      console.debug('prev date fetch error', err);
      setEditorPuzzle(getDefaultPuzzle(size));
    }
    setSaveDate(ds);
  };

  const handleClearEditor = () => {
    setEditorPuzzle(getDefaultPuzzle(size));
  };

  const rawEmail = session?.user?.email ?? "";
  const isEditorAllowed = rawEmail.trim().toLowerCase() === "tyler.apsley@gmail.com";

  useEffect(() => {
    if (!isEditorAllowed) {
      setEditorMode(false);
      setEditorPuzzle(null);
      setSaveDate("");
      if (findNextAbort.current) { try { findNextAbort.current.abort(); } catch {} }
    }
  }, [isEditorAllowed]);

  // No local sync effect needed — provider is the source-of-truth.

  // Save progress when grid changes (not in editor mode)

  // Debounce save effect
  const debounceTimeout = useRef<number | null>(null);
  useEffect(() => {
    if (editorMode) return;
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = window.setTimeout(async () => {
      if (!userIsLoggedIn) {
        // persist to localStorage for anonymous users (grid only).
        try {
          const key = `picross:progress:${dateStr}:${difficulty}`;
          const payload = { grid, complete: cleared };
          window.localStorage.setItem(key, JSON.stringify(payload));
        } catch (err) {
          console.debug('localStorage write error', err);
        }
        return;
      }
      await fetch("/api/picross/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          [difficulty]: grid,
          [`${difficulty}Complete`]: cleared,
        }),
      });
      // No context update here; context is updated optimistically on click
    }, 400); // 400ms debounce
    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [grid, cleared, difficulty, userIsLoggedIn, editorMode, dateStr]);

  // Helpers to determine user-filled runs for rows/columns (used to gray-out fulfilled clues)
  const isFilledCell = (r: number, c: number) => {
    if (editorMode) {
      const p = editorPuzzle ?? ((prefetchPuzzle && prefetchPuzzle[difficulty]) ?? getDefaultPuzzle(size));
      return !!(p && p[r] && p[r][c]);
    }
    const v = (grid && grid[r] && typeof grid[r][c] !== 'undefined') ? grid[r][c] : 0;
    return v === 1;
  };

  const isXCell = (r: number, c: number) => {
    if (editorMode) return false;
    const v = (grid && grid[r] && typeof grid[r][c] !== 'undefined') ? grid[r][c] : 0;
    return v === 3;
  };

  const getRunsForRow = (r: number) => {
    const runs: number[] = [];
    let count = 0;
    for (let c = 0; c < size; c++) {
      if (isFilledCell(r, c)) count++;
      else if (count) { runs.push(count); count = 0; }
    }
    if (count) runs.push(count);
    return runs;
  };

  // Returns runs with start/end positions and whether the run is bounded by X (or edge)
  const getRunsMetaForRow = (r: number) => {
    const runs: Array<{ len: number; start: number; end: number; bounded: boolean }> = [];
    let count = 0;
    let start = 0;
    for (let c = 0; c < size; c++) {
      if (isFilledCell(r, c)) {
        if (count === 0) start = c;
        count++;
      } else if (count) {
        const end = c - 1;
        const leftBound = start === 0 || isXCell(r, start - 1);
        const rightBound = end === size - 1 || isXCell(r, end + 1);
        runs.push({ len: count, start, end, bounded: leftBound && rightBound });
        count = 0;
      }
    }
    if (count) {
      const end = size - 1;
      const leftBound = start === 0 || isXCell(r, start - 1);
      const rightBound = end === size - 1 || isXCell(r, end + 1);
      runs.push({ len: count, start, end, bounded: leftBound && rightBound });
    }
    return runs;
  };

  const getRunsForCol = (c: number) => {
    const runs: number[] = [];
    let count = 0;
    for (let r = 0; r < size; r++) {
      if (isFilledCell(r, c)) count++;
      else if (count) { runs.push(count); count = 0; }
    }
    if (count) runs.push(count);
    return runs;
  };

  const getRunsMetaForCol = (c: number) => {
    const runs: Array<{ len: number; start: number; end: number; bounded: boolean }> = [];
    let count = 0;
    let start = 0;
    for (let r = 0; r < size; r++) {
      if (isFilledCell(r, c)) {
        if (count === 0) start = r;
        count++;
      } else if (count) {
        const end = r - 1;
        const topBound = start === 0 || isXCell(start - 1, c);
        const bottomBound = end === size - 1 || isXCell(end + 1, c);
        runs.push({ len: count, start, end, bounded: topBound && bottomBound });
        count = 0;
      }
    }
    if (count) {
      const end = size - 1;
      const topBound = start === 0 || isXCell(start - 1, c);
      const bottomBound = end === size - 1 || isXCell(end + 1, c);
      runs.push({ len: count, start, end, bounded: topBound && bottomBound });
    }
    return runs;
  };

  // Given clue numbers, detected runs and run meta, return an array of booleans
  // indicating whether each clue should be treated as fulfilled (grayed).
  const computeFulfilledArray = (clues: number[], runs: number[], meta: Array<{ len: number; start: number; end: number; bounded: boolean }>) => {
    const anyFilled = meta.length > 0;
    const fulfilledArr: boolean[] = [];
    // build counts of bounded runs by length to use as fallback matches
    const boundedCounts: Record<number, number> = {};
    for (const m of meta) if (m.bounded) boundedCounts[m.len] = (boundedCounts[m.len] || 0) + 1;

    for (let j = 0; j < clues.length; j++) {
      const n = clues[j];
      let fulfilled = false;
      if (n === 0) fulfilled = !anyFilled;
      else {
        if (runs.length === clues.length && typeof runs[j] !== 'undefined' && runs[j] === n) {
          fulfilled = true;
        } else {
          const m = meta[j];
          if (m && m.len === n && m.bounded) {
            fulfilled = true;
            if (boundedCounts[n]) boundedCounts[n]--;
          } else if (!fulfilled && boundedCounts[n]) {
            // consume a matching bounded run as a fallback
            fulfilled = true;
            boundedCounts[n]--;
          }
        }
      }
      fulfilledArr.push(fulfilled);
    }
    return fulfilledArr;
  };

  // fixed font for grid/clues
  const [fontFamily] = useState<string>(DEFAULT_FONT);
  const fontWeight = 700;

  // Compute a responsive `cellPx` so the entire grid (including clue areas)
  // fits inside the viewport on small devices. We reserve `slots` clue
  // columns/rows (fixed to up to 5) and compute cellPx from the available
  // viewport so the user cannot scroll the play screen.
  useEffect(() => {
    const calc = () => {
      try {
        const slots = Math.min(5, size);
        const denom = size + slots; // total slots horizontally/vertically consumed by grid+clues
        const marginW = 32; // page padding
        const marginH = 140; // header + controls area reserved vertically
        const cellPxW = Math.floor((window.innerWidth - marginW) / denom);
        const cellPxH = Math.floor((window.innerHeight - marginH) / denom);
        const px = Math.max(16, Math.min(40, Math.max(8, Math.min(cellPxW, cellPxH))));
        setCellPx(px);
      } catch {
        setCellPx(40);
      }
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [size]);

  return (
    <div style={{ position: 'fixed', inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: 'flex-start', marginTop: 0, background: '#cca3ff', width: '100%', overflow: 'hidden', paddingTop: 132 }}>
      <div style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 15, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-start', zIndex: 30 }}>
        <button
          onClick={async () => {
            try {
              await saveSecondsNow();
            } catch (err) {
              console.debug('picross:save on back err', err);
            }
            router.push('/nonogram');
          }}
          aria-label="Back"
          style={{ background: 'transparent', border: 'none', padding: '6px 0px', margin: 0, fontSize: 26, lineHeight: 1, cursor: 'pointer', color: '#000', fontWeight: 800 }}
        >
          ❮
        </button>
        <h2 style={{ margin: 5, paddingLeft: 20, fontFamily: "Courier", fontWeight:"600", fontSize:25}}>{formattedDate}</h2>
      
        {/* Editor toggle moved into the left clue area so it appears above the number zone */}
      </div>
      {/* editor menu moved to bottom controls area */}
      {/* cleared message removed; celebratory text will appear at bottom during celebration */}
      <div onPointerMove={e => {
        if (cleared) return;
        if (!pointerActiveRef.current || !pointerActionRef.current) return;
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        if (!el) return;
        const cellEl = el.closest('[data-picross-cell]') as HTMLElement | null;
        if (!cellEl) return;
        const rr = Number(cellEl.dataset.r);
        const cc = Number(cellEl.dataset.c);
        if (Number.isNaN(rr) || Number.isNaN(cc)) return;
                if (editorMode) {
          if (pointerActionRef.current === 'fill' || pointerActionRef.current === 'erase') {
            const doFill = pointerActionRef.current === 'fill';
            setEditorPuzzle(prev => {
              const base = prev ?? ((prefetchPuzzle && prefetchPuzzle[difficulty]) ?? getDefaultPuzzle(size));
              const next = base.map(row => [...row]);
              if (next[rr][cc] !== doFill) next[rr][cc] = doFill;
              return next;
            });
          }
                } else {
          applyActionToCell(rr, cc, pointerActionRef.current);
        }
      }} style={{ touchAction: 'none', fontFamily: fontFamily, fontWeight: fontWeight }}>
        <div style={{ display: "flex" }}>
          <div style={{ width: leftWidth, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 6 }}>
            {isEditorAllowed && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={editorMode} onChange={e => { const checked = e.target.checked; setEditorMode(checked); if (checked) { setEditorPuzzle((prefetchPuzzle && prefetchPuzzle[difficulty]) ?? getDefaultPuzzle(size)); (async () => {
                      if (findNextAbort.current) { try { findNextAbort.current.abort(); } catch {} }
                      const ac = new AbortController(); findNextAbort.current = ac;
                      try {
                        const today = new Date();
                        for (let i = 0; i < 365; i++) {
                          const d = new Date(today); d.setDate(today.getDate() + i); const ds = d.toISOString().slice(0, 10);
                          const res = await fetch(`/api/picross/puzzle?date=${ds}`, { signal: ac.signal });
                          if (res.status === 404) { setEditorPuzzle(getDefaultPuzzle(size)); setSaveDate(ds); findNextAbort.current = null; return; }
                          if (res.ok) { const json = await res.json(); const entry = json?.[difficulty]; if (isPuzzleEmpty(entry)) { setEditorPuzzle(getDefaultPuzzle(size)); setSaveDate(ds); findNextAbort.current = null; return; } }
                        }
                        setSaveDate(today.toISOString().slice(0, 10));
                      } catch (err) { const maybe = err as { name?: string } | undefined; if (maybe && maybe.name === 'AbortError') return; console.debug('findNextFreeDate error', err); } finally { findNextAbort.current = null; }
                    })(); } else { setEditorPuzzle(null); setSaveDate(''); if (findNextAbort.current) { try { findNextAbort.current.abort(); } catch {} } } }} />
                Editor
              </label>
            )}
            <div style={{ fontSize: 29, fontFamily: 'monospace', marginTop: 15 }}>{formatSec(elapsedSec)}</div>
          </div>
          {colClues.map((clue, i) => {
            const runs = getRunsForCol(i);
            const meta = getRunsMetaForCol(i);
            const fulfilled = computeFulfilledArray(clue, runs, meta);
            return (
              <div key={i} style={{ width: cellPx, minHeight: topHeight, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', fontSize: CLUE_FONT_PX, marginBottom: 0, paddingBottom: 2, background: (i % 2 === 0) ? '#e8e8e8' : '#ffffff' }}>
                {clue.map((n, j) => <div key={j} style={{ color: fulfilled[j] ? '#888' : '#000' }}>{n}</div>)}
              </div>
            );
          })}
        </div>
        {(editorMode ? puzzle : grid).map((row: (boolean[] | CellState[]), r: number) => (
          <div key={r} style={{ display: "flex" }}>
            <div style={{ width: leftWidth, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: CLUE_FONT_PX, paddingRight: 12, background: (r % 2 === 0) ? '#e8e8e8' : '#ffffff' }}>
              <div style={{ display: 'flex', gap: clueGap, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{(() => {
                const runs = getRunsForRow(r);
                const meta = getRunsMetaForRow(r);
                const anyFilledInRow = meta.length > 0;
                const boundedCounts: Record<number, number> = {};
                for (const m of meta) if (m.bounded) boundedCounts[m.len] = (boundedCounts[m.len] || 0) + 1;
                return rowClues[r].map((n: number, j: number) => {
                  let fulfilled = false;
                  if (n === 0) fulfilled = !anyFilledInRow;
                  else {
                    if (runs.length === rowClues[r].length && typeof runs[j] !== 'undefined' && runs[j] === n) {
                      fulfilled = true;
                    } else {
                      const m = meta[j];
                      if (m && m.len === n && m.bounded) {
                        fulfilled = true;
                        if (boundedCounts[n]) boundedCounts[n]--;
                      } else if (!fulfilled && boundedCounts[n]) {
                        fulfilled = true;
                        boundedCounts[n]--;
                      }
                    }
                  }
                  return <span key={j} style={{ color: fulfilled ? '#888' : '#000' }}>{n}</span>;
                });
              })()}</div>
            </div>
          {row.map((cell: boolean | CellState, c: number) => (
            <div
              key={c}
              data-picross-cell
              data-r={String(r)}
              data-c={String(c)}
              onPointerDown={e => {
                // start pointer drag
                e.preventDefault();
                if (cleared) return;
                pointerActiveRef.current = true;
                if (editorMode) {
                  // toggle cell in editor and set drag action to continue filling or erasing
                  const cur = (editorPuzzle && editorPuzzle[r] && typeof editorPuzzle[r][c] !== 'undefined')
                    ? !!editorPuzzle[r][c]
                    : !!(prefetchPuzzle && prefetchPuzzle[difficulty] && prefetchPuzzle[difficulty][r] && prefetchPuzzle[difficulty][r][c]);
                  const newVal = !cur;
                  setEditorPuzzle(prev => {
                    const base = prev ?? ((prefetchPuzzle && prefetchPuzzle[difficulty]) ?? getDefaultPuzzle(size));
                    const next = base.map(row => [...row]);
                    next[r][c] = newVal;
                    return next;
                  });
                  pointerActionRef.current = newVal ? 'fill' : 'erase';
                  return;
                }
                const val = (prefetchProgress && prefetchProgress[difficulty] && prefetchProgress[difficulty][r] && prefetchProgress[difficulty][r][c]) ?? 0;
                // determine action based on current input mode and clicked cell
                // If this was a right-click on desktop, always treat as X mode
                if ((e as any).button === 2) {
                  if (val === 1 || val === 3) {
                    pointerActionRef.current = 'erase';
                    applyActionToCell(r, c, 'erase');
                  } else {
                    pointerActionRef.current = 'fillX';
                    applyActionToCell(r, c, 'fillX');
                  }
                  return;
                }

                if (inputMode === 'fill') {
                  if (val === 1) {
                    // clicking a filled cell toggles to erase
                    pointerActionRef.current = 'erase';
                    applyActionToCell(r, c, 'erase');
                  } else if (val === 3) {
                    // clicking an X in fill mode should make it blank (erase) for the click,
                    // but dragging afterwards should act as a normal fill drag (and should NOT overwrite other Xs).
                    // So perform a one-off erase here, then set drag action to 'fill'.
                    setPrefetch(prev => {
                      const cur = (prev.progress && prev.progress[difficulty]) ?? Array.from({ length: size }, () => Array.from({ length: size }, () => 0 as CellState));
                      const next: CellState[][] = cur.map((row: CellState[]) => row.map(v => (Math.max(0, Math.min(3, Math.trunc(Number(v as unknown) || 0))) as CellState)));
                      next[r][c] = 0;
                      return {
                        ...prev,
                        progress: {
                          ...prev.progress,
                          [difficulty]: next,
                        },
                      };
                    });
                    pointerActionRef.current = 'fill';
                  } else {
                    pointerActionRef.current = 'fill';
                    applyActionToCell(r, c, 'fill');
                  }
                } else if (inputMode === 'x') {
                  // X mode: clicking a filled square should erase it; clicking empty sets X
                  if (val === 1 || val === 3) {
                    pointerActionRef.current = 'erase';
                    applyActionToCell(r, c, 'erase');
                  } else {
                    pointerActionRef.current = 'fillX';
                    applyActionToCell(r, c, 'fillX');
                  }
                } else {
                  // maybe
                  pointerActionRef.current = (val === 2 ? 'eraseMaybe' : 'fillMaybe');
                  applyActionToCell(r, c, pointerActionRef.current);
                }
              }}
              onPointerEnter={() => {
                if (cleared) return;
                if (!pointerActiveRef.current || !pointerActionRef.current) return;
                if (editorMode) {
                  // continue applying fill/erase to editor puzzle while dragging
                  if (pointerActionRef.current === 'fill' || pointerActionRef.current === 'erase') {
                    const doFill = pointerActionRef.current === 'fill';
                    setEditorPuzzle(prev => {
                      const base = prev ?? ((prefetchPuzzle && prefetchPuzzle[difficulty]) ?? getDefaultPuzzle(size));
                      const next = base.map(row => [...row]);
                      if (next[r][c] !== doFill) next[r][c] = doFill;
                      return next;
                    });
                  }
                  return;
                }
                applyActionToCell(r, c, pointerActionRef.current);
              }}
              onContextMenu={e => e.preventDefault()}
              style={{
                width: cellPx, height: cellPx, display: "flex", alignItems: "center", justifyContent: "center",
                borderStyle: 'solid', borderWidth: 1, borderColor: '#888',
                // mid/grid divider highlights: keep default 1px grid lines and bump the relevant side to a thicker green
                borderRightWidth: 1,
                borderRightColor: ((size >= 10 && c === 4) || (size === 15 && c === 9)) ? DIVIDER_COLOR : '#888',
                borderLeftWidth: 1,
                borderLeftColor: ((size >= 10 && c === 5) || (size === 15 && c === 10)) ? DIVIDER_COLOR : '#888',
                borderBottomWidth: 1,
                borderBottomColor: ((size >= 10 && r === 4) || (size === 15 && r === 9)) ? DIVIDER_COLOR : '#888',
                borderTopWidth: 1,
                borderTopColor: ((size >= 10 && r === 5) || (size === 15 && r === 10)) ? DIVIDER_COLOR : '#888',
                background: (() => {
                  // celebration override: if celebrateGrid marks this cell, show gold
                  if (celebrateGrid && celebrateGrid[r] && celebrateGrid[r][c]) return '#d4af37';
                  if (editorMode) return (cell ? "#222" : "#fff");
                  const val = (cell as unknown) as CellState;
                  if (val === 1) return '#222';
                  if (val === 2) return '#f0f0f0';
                  return '#fff';
                })(),
                cursor: "pointer", fontSize: Math.max(12, Math.round(cellPx * 0.65)), userSelect: "none", touchAction: 'none'
              }}
            >
              {!editorMode && ((cell as unknown) as CellState) === 3 && (
                <div style={{ color: '#c53030', fontWeight: 800, fontSize: Math.round(cellPx * 0.7), lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'translateY(2px)' }}>✕</div>
              )}
              {!editorMode && ((cell as unknown) as CellState) === 2 && (
                <div style={{ width: Math.max(6, Math.round(cellPx * 0.25)), height: Math.max(6, Math.round(cellPx * 0.25)), borderRadius: 6, background: '#666' }} />
              )}
              {celebrateGrid && celebrateGrid[r] && celebrateGrid[r][c] && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }} />
              )}
            </div>
          ))}
        </div>
      ))}</div>
      {/* Mode selector bar -> replaced by celebration text when animation starts */}
      {celebrateGrid ? (
        <div style={{ marginTop: 18, width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div style={{ background: 'transparent', color: '#5a2b8a', fontWeight: 800, fontSize: 24, padding: '12px 16px', borderRadius: 8, textShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>
            Puzzle Complete!
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 15, width: '100%', display: 'flex', justifyContent: 'center', gap: 12 }}>
          {editorMode ? (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <button onClick={handleClearEditor} style={dangerBtnStyle}>Clear</button>
              <button onClick={handlePrevDate} style={{ ...baseBtnStyle }}>Previous</button>
              <button onClick={handleNextDate} style={{ ...baseBtnStyle }}>Next</button>
              <input type="date" value={saveDate} onChange={e => setSaveDate(e.target.value)} style={{ marginLeft: 8, marginRight: 8 }} />
              <button onClick={handleSave} disabled={!saveDate} style={{ ...primaryBtnStyle }}>Save</button>
            </div>
          ) : (
            (["fill", "maybe", "x"] as const).map(m => {
              let icon: React.ReactNode = null;
              const iconBox: React.CSSProperties = { width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' };
              if (m === 'fill') {
                icon = <div style={{ ...iconBox, background: '#222', borderRadius: 2 }} />;
              } else if (m === 'maybe') {
                icon = (
                  <div style={iconBox}>
                    <div style={{ width: 8, height: 8, borderRadius: 6, background: '#666' }} />
                  </div>
                );
              } else {
                icon = <div style={{ ...iconBox, color: '#c53030', fontWeight: 800, fontSize: 16 }}>✕</div>;
              }
              const label = m === 'fill' ? 'Fill' : m === 'maybe' ? 'Maybe' : 'X';
              const isSelected = inputMode === m;
              const isHovered = hoveredMode === m;
              const style: React.CSSProperties = { ...baseBtnStyle, minWidth: 56, textAlign: 'center' };
              if (isSelected) Object.assign(style, selectedBtnStyle);
              else if (isHovered) Object.assign(style, hoverBtnStyle);
              return (
                <button
                  key={m}
                  onClick={() => setInputMode(m)}
                  onMouseEnter={() => setHoveredMode(m)}
                  onMouseLeave={() => setHoveredMode(null)}
                  style={style}
                  aria-label={label}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {icon}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function PicrossPage() {
  return (
    <React.Suspense fallback={<div>Loading Nonogram...</div>}>
      <PicrossPlayInner />
    </React.Suspense>
  );
}
