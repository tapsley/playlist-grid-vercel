// Moved PicrossPage implementation here from page.tsx
"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import type { CellState } from "../PicrossPrefetchContext";
import { usePicrossPrefetch } from "../PicrossPrefetchContext";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import GridBoard from '../components/GridBoard';
import Controls from '../components/Controls';

const DIFFICULTY_CONFIG: Record<string, { size: number; leftWidthPx: number; topHeightPx: number; clueFontPx: number }> = {
  // Fixed pixel sizes and clue font for left/top clue regions per difficulty — adjust as needed
  easy: { size: 5, leftWidthPx: 100, topHeightPx: 100, clueFontPx: 20 },
  medium: { size: 10, leftWidthPx: 125, topHeightPx: 125, clueFontPx: 16 },
  hard: { size: 15, leftWidthPx: 240, topHeightPx: 240, clueFontPx: 18 },
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

function isPuzzleEmpty(entry: any) {
  try {
    if (!entry) return true;
    if (!Array.isArray(entry)) return true;
    if (entry.length === 0) return true;
    for (const row of entry) {
      if (Array.isArray(row)) {
        for (const cell of row) if (cell) return false;
      }
    }
    return true;
  } catch {
    return true;
  }
}

function PicrossPlayInner() {

  // Router / session / provider
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { puzzle: prefetchPuzzle, progress: prefetchProgress, setPrefetch } = usePicrossPrefetch();

  // derive date/difficulty
  const dateStr = (searchParams && searchParams.get && searchParams.get('date')) || new Date().toISOString().slice(0, 10);
  const formattedDate = new Date(dateStr).toLocaleDateString();
  const difficulty = (searchParams && searchParams.get && (searchParams.get('difficulty') || 'easy')) as string;
  const size = DIFFICULTY_CONFIG[difficulty]?.size ?? 5;

  // provider-backed puzzle and grid (CellState values 0..3)
  const puzzle = (prefetchPuzzle && prefetchPuzzle[difficulty]) ?? getDefaultPuzzle(size);
  const grid: (number[] | any)[] = (prefetchProgress && prefetchProgress[difficulty]) ?? Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

  // UI / editor state
  const [editorMode, setEditorMode] = useState(false);
  const [editorPuzzle, setEditorPuzzle] = useState<boolean[][] | null>(null);
  const [inputMode, setInputMode] = useState<'fill' | 'maybe' | 'x'>('fill');
  const [hoveredMode, setHoveredMode] = useState<string | null>(null);

  // timer + persistence refs/state
  const timerRef = useRef<number | null>(null);
  const saveTimerDebounce = useRef<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState<number>(() => {
    try {
      const key = `picross:seconds:${dateStr}:${difficulty}`;
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      return raw ? (Number(raw) || 0) : 0;
    } catch { return 0; }
  });

  const userIsLoggedIn = !!session?.user?.email;

  // celebration / PB
  const [showNewPB, setShowNewPB] = useState(false);
  const pbTimeoutRef = useRef<number | null>(null);
  const celebrationTimeouts = useRef<number[]>([]);
  const [celebrateGrid, setCelebrateGrid] = useState<boolean[][] | null>(null);

  // pointer drag refs
  const pointerActiveRef = useRef(false);
  type Action = "fill" | "erase" | "fillX" | "fillMaybe" | "eraseMaybe";
  const pointerActionRef = useRef<null | Action>(null);

  // misc refs
  const findNextAbort = useRef<AbortController | null>(null);

  // layout constants
  const DEFAULT_FONT = 'Courier New, monospace';
  
  const CLUE_FONT_PX = DIFFICULTY_CONFIG[difficulty]?.clueFontPx ?? 18;
  const clueGap = 12;
  const topHeight = DIFFICULTY_CONFIG[difficulty]?.topHeightPx ?? 120;
  const leftWidth = DIFFICULTY_CONFIG[difficulty]?.leftWidthPx ?? 120;
  const [cellPx, setCellPx] = useState<number>(32);

  // small button styles used in controls area
  const baseBtnStyle: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, background: '#fff', border: '1px solid #ddd', cursor: 'pointer' };
  const primaryBtnStyle: React.CSSProperties = { ...baseBtnStyle, background: '#4a90e2', color: '#fff', border: 'none' };
  const dangerBtnStyle: React.CSSProperties = { ...baseBtnStyle, background: '#fff', border: '1px solid #f44336', color: '#f44336' };
  const selectedBtnStyle: React.CSSProperties = { boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.06)', background: '#eee' };
  const hoverBtnStyle: React.CSSProperties = { background: '#fafafa' };

  // compute clues
  const { rows: rowClues, cols: colClues } = useMemo(() => getClues(puzzle), [puzzle]);

  // cleared: check whether all required puzzle cells are filled
  const cleared = useMemo(() => {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (puzzle[r][c] && ((grid[r] && Number(grid[r][c]) !== 1))) return false;
      }
    }
    return true;
  }, [puzzle, grid, size]);


// Start timer on mount (and resume) unless puzzle already cleared or in editorMode
useEffect(() => {
  if (editorMode) return;
  if (cleared) return;
  if (timerRef.current) return;
  timerRef.current = window.setInterval(() => setElapsedSec(s => s + 1) as unknown as number, 1000) as unknown as number;
  return () => {
    if (timerRef.current) { window.clearInterval(timerRef.current as unknown as number); timerRef.current = null; }
  };
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
            // persist a local personal-best fallback for anonymous users
            try {
              const bestKey = `picross:fastest:${difficulty}`;
              const existing = Number(window.localStorage.getItem(bestKey) || 0) || 0;
              if (!existing || elapsedSec < existing) {
                window.localStorage.setItem(bestKey, String(elapsedSec));
              }
            } catch {}
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
      //Set timer color to gold if it is a new personal best
      try {
        // Determine prior fastest for this difficulty and show a brief message if we beat it.
        (async () => {
          try {
            let prior: number | null = null;
            if (userIsLoggedIn) {
              try {
                const res = await fetch('/api/picross/stats');
                if (res.ok) {
                  const json = await res.json();
                  prior = Number(json?.fastest?.[difficulty] ?? null) || null;
                }
              } catch (err) {
                // ignore stats fetch failure
              }
            } else {
              try {
                const bestKey = `picross:fastest:${difficulty}`;
                const raw = window.localStorage.getItem(bestKey);
                const n = raw ? (Number(raw) || 0) : 0;
                if (n) prior = n;
              } catch {}
            }

            if (elapsedSec > 0 && (prior === null || elapsedSec < prior)) {
              // update local fallback and show message
              try { window.localStorage.setItem(`picross:fastest:${difficulty}`, String(elapsedSec)); } catch {}
              setShowNewPB(true);
              if (pbTimeoutRef.current) window.clearTimeout(pbTimeoutRef.current);
              pbTimeoutRef.current = window.setTimeout(() => { setShowNewPB(false); pbTimeoutRef.current = null; }, 8000) as unknown as number;
            }
          } catch (err) {
            console.debug('picross:detect pb err', err);
          }
        })();
      } catch {}



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
  }, [cleared]);
  const [saveDate, setSaveDate] = useState("");

  

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

  // Clear PB timeout on unmount
  useEffect(() => {
    return () => {
      if (pbTimeoutRef.current) {
        try { window.clearTimeout(pbTimeoutRef.current); } catch {};
        pbTimeoutRef.current = null;
      }
    };
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
    <div style={{ position: 'fixed', inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: 'flex-start', marginTop: 0, background: '#cca3ff', width: '100%', overflow: 'hidden', paddingTop: 72 }}>
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
      <GridBoard
        size={size}
        leftWidth={leftWidth}
        topHeight={topHeight}
        cellPx={cellPx}
        CLUE_FONT_PX={CLUE_FONT_PX}
        clueGap={clueGap}
        puzzle={puzzle}
        grid={grid}
        editorMode={editorMode}
        setEditorMode={setEditorMode}
        editorPuzzle={editorPuzzle}
        setEditorPuzzle={setEditorPuzzle}
        prefetchPuzzle={prefetchPuzzle}
        prefetchProgress={prefetchProgress}
        setPrefetch={setPrefetch}
        difficulty={difficulty}
        isEditorAllowed={isEditorAllowed}
        findNextAbort={findNextAbort}
        elapsedSec={elapsedSec}
        cleared={cleared}
        showNewPB={showNewPB}
        setShowNewPB={setShowNewPB}
        pointerActiveRef={pointerActiveRef}
        pointerActionRef={pointerActionRef}
        applyActionToCell={applyActionToCell}
        inputMode={inputMode}
        saveDate={saveDate}
        setSaveDate={setSaveDate}
        handleSave={handleSave}
        handleNextDate={handleNextDate}
        handlePrevDate={handlePrevDate}
        handleClearEditor={handleClearEditor}
        getRunsForCol={getRunsForCol}
        getRunsMetaForCol={getRunsMetaForCol}
        getRunsForRow={getRunsForRow}
        getRunsMetaForRow={getRunsMetaForRow}
        isFilledCell={isFilledCell}
        isXCell={isXCell}
        celebrateGrid={celebrateGrid}
        rowClues={rowClues}
        colClues={colClues}
        fontFamily={fontFamily}
        fontWeight={fontWeight}
      />
      {/* Mode selector bar -> replaced by celebration text when animation starts */}
      {celebrateGrid ? (
        <div style={{ marginTop: 18, width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div style={{ background: 'transparent', color: '#5a2b8a', fontWeight: 800, fontSize: 24, padding: '12px 16px', borderRadius: 8, textShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>
            Puzzle Complete!
          </div>
        </div>
      ) : (
          <Controls 
            editorMode={editorMode}
            handleClearEditor={handleClearEditor}
            handlePrevDate={handlePrevDate}
            handleNextDate={handleNextDate}
            handleSave={handleSave}
            saveDate={saveDate}
            setSaveDate={setSaveDate}
            inputMode={inputMode}
            setInputMode={setInputMode}
            hoveredMode={hoveredMode}
            setHoveredMode={setHoveredMode}
            dangerBtnStyle={dangerBtnStyle}
            baseBtnStyle={baseBtnStyle}
            primaryBtnStyle={primaryBtnStyle}
            selectedBtnStyle={selectedBtnStyle}
            hoverBtnStyle={hoverBtnStyle}
            celebrateGrid={celebrateGrid}
          />
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
