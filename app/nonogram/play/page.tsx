// Moved PicrossPage implementation here from page.tsx
"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { gsap } from 'gsap';
import type { CellState } from "../PicrossPrefetchContext";
import { usePicrossPrefetch } from "../PicrossPrefetchContext";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import GridBoard from '../components/GridBoard';
import Controls from '../components/Controls';
import { getMSTDateString } from '../time';
import pickSequence from '../celebrations/sequenceBank';

const DIFFICULTY_CONFIG: Record<string, { size: number; leftWidthPx: number; topHeightPx: number; clueFontPx: number; cellPxDefault?: number; autoScaleEnabled?: boolean; minCellPx?: number; maxCellPx?: number; minClueFontPx?: number; clueGap?: number }> = {
  // Per-difficulty layout defaults. Feel free to tweak these values.
  easy: { size: 5, leftWidthPx: 100, topHeightPx: 100, clueFontPx: 20, cellPxDefault: 32, autoScaleEnabled: false, minCellPx: 12, maxCellPx: 48, minClueFontPx: 12, clueGap: 12 },
  medium: { size: 10, leftWidthPx: 125, topHeightPx: 125, clueFontPx: 16, cellPxDefault: 28, autoScaleEnabled: false, minCellPx: 10, maxCellPx: 40, minClueFontPx: 11, clueGap: 12 },
  hard: { size: 15, leftWidthPx: 125, topHeightPx: 125, clueFontPx: 9, cellPxDefault: 24, autoScaleEnabled: true, minCellPx: 19, maxCellPx: 25, minClueFontPx: 10, clueGap: 8 },
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
  const dateStr = (searchParams && searchParams.get && searchParams.get('date')) || getMSTDateString();
  // Parse YYYY-MM-DD into a local Date (avoid UTC parsing which can shift the day
  // depending on the user's timezone). This ensures the displayed calendar date
  // matches the intended date string.
  let formattedDate = dateStr;
  try {
    const parts = (dateStr || '').split('-');
    if (parts.length === 3) {
      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const d = Number(parts[2]);
      const local = new Date(y, m, d);
      formattedDate = local.toLocaleDateString();
    } else {
      formattedDate = new Date(dateStr).toLocaleDateString();
    }
  } catch {
    try { formattedDate = new Date(dateStr).toLocaleDateString(); } catch { formattedDate = dateStr; }
  }
  const difficulty = (searchParams && searchParams.get && (searchParams.get('difficulty') || 'easy')) as string;
  const size = DIFFICULTY_CONFIG[difficulty]?.size ?? 5;
  const config = DIFFICULTY_CONFIG[difficulty] ?? DIFFICULTY_CONFIG['easy'];

  // provider-backed puzzle and grid (CellState values 0..3)
  const puzzle = (prefetchPuzzle && prefetchPuzzle[difficulty]) ?? getDefaultPuzzle(size);
  const grid: (number[] | any)[] = (prefetchProgress && prefetchProgress[difficulty]) ?? Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

  // Determine whether this is the first time the user is seeing this puzzle
  // (no prior progress). If there is any non-zero cell in provider progress,
  // consider it not a first start.
  const hasProgress = !!(prefetchProgress && prefetchProgress[difficulty] && (prefetchProgress[difficulty] as any).some((row: any) => Array.isArray(row) && row.some((v: any) => Number(v) !== 0)));
  // Also respect a persisted "start shown" flag so we don't replay the
  // START animation repeatedly across navigations for the same puzzle/date.
  let firstStart = !hasProgress;
  try {
    const shownKey = `picross:startShown:${dateStr}:${difficulty}`;
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(shownKey) : null;
    if (raw === '1') firstStart = false;
  } catch {}

  // Track whether the START animation has completed. If this is not a
  // first start, we consider the animation already done so the timer can run.
  const [startAnimationDone, setStartAnimationDone] = useState<boolean>(() => !firstStart);

  const userIsLoggedIn = !!session?.user?.email;

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
      const localVal = raw ? (Number(raw) || 0) : 0;
      // If a session exists at mount, prefer server value (fetch will update shortly).
      // Initialize to 0 for logged-in mounts to avoid showing another user's local seconds.
      return userIsLoggedIn ? 0 : localVal;
    } catch { return 0; }
  });

  // celebration / PB
  const [showNewPB, setShowNewPB] = useState(false);
  const pbTimeoutRef = useRef<number | null>(null);
  const celebrationTimeouts = useRef<number[]>([]);
  const [celebrateGrid, setCelebrateGrid] = useState<boolean[][] | null>(null);

  // pointer drag refs
  const pointerActiveRef = useRef(false);
  type Action = "fill" | "erase" | "fillX" | "fillMaybe" | "eraseMaybe";
  const pointerActionRef = useRef<null | Action>(null);

  // celebration guard to prevent overlapping animations
  const isCelebratingRef = useRef(false);

  // misc refs
  const findNextAbort = useRef<AbortController | null>(null);

  // layout constants
  const DEFAULT_FONT = 'Courier New, monospace';
  
  const [minClueFontPx, setMinClueFontPx] = useState<number>(10);
  const CLUE_FONT_PX = Math.max((DIFFICULTY_CONFIG[difficulty]?.clueFontPx ?? 18), minClueFontPx);
  const clueGap = DIFFICULTY_CONFIG[difficulty]?.clueGap ?? 12;
  const topHeight = DIFFICULTY_CONFIG[difficulty]?.topHeightPx ?? 120;
  const leftWidth = DIFFICULTY_CONFIG[difficulty]?.leftWidthPx ?? 120;
  const [cellPx, setCellPx] = useState<number>(32);
  const [autoScaleEnabled, setAutoScaleEnabled] = useState<boolean>(true);
  const [minCellPx, setMinCellPx] = useState<number>(12);
  const [maxCellPx, setMaxCellPx] = useState<number>(48);

  // Responsive cell sizing: ensure the hard (15x15) grid fits on narrow screens
  useEffect(() => {
    // initialize scaling/clue defaults from per-difficulty config when difficulty changes
    try {
      const cfg = DIFFICULTY_CONFIG[difficulty] ?? DIFFICULTY_CONFIG['easy'];
      if (cfg.cellPxDefault) setCellPx(cfg.cellPxDefault);
      if (typeof cfg.autoScaleEnabled !== 'undefined') setAutoScaleEnabled(cfg.autoScaleEnabled as boolean);
      if (cfg.minCellPx) setMinCellPx(cfg.minCellPx);
      if (cfg.maxCellPx) setMaxCellPx(cfg.maxCellPx);
      if (cfg.minClueFontPx) setMinClueFontPx(cfg.minClueFontPx);
    } catch (err) {}

    const compute = () => {
      try {
        // available width: viewport minus some padding and left clue column
        const padding = 32; // left+right safe padding
        const extra = 24; // spacing/margins
        const avail = Math.max(120, window.innerWidth - padding - leftWidth - extra);
        // compute px per cell to fit the grid width
        const candidate = Math.floor(avail / size);
        // guard mins/max: keep cells usable
        const minCell = minCellPx ?? 12;
        const maxCell = maxCellPx ?? 48;
        const newPx = Math.max(minCell, Math.min(maxCell, candidate || minCell));
        // Only auto-scale for hard difficulty (15x15). For other difficulties, keep existing default.
        if (autoScaleEnabled && difficulty === 'hard') setCellPx(newPx);
      } catch (err) {
        // ignore
      }
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
    // include dependencies that affect layout
  }, [difficulty, leftWidth, size, autoScaleEnabled, minCellPx, maxCellPx]);

  // small button styles used in controls area
  const baseBtnStyle: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, background: '#fff', border: '0px solid #ddd', cursor: 'pointer' };
  const primaryBtnStyle: React.CSSProperties = { ...baseBtnStyle, background: '#4a90e2', color: '#fff', border: 'none' };
  const dangerBtnStyle: React.CSSProperties = { ...baseBtnStyle, background: '#fff', border: '2px solid #f44336', color: '#f44336' };
  const selectedBtnStyle: React.CSSProperties = { boxShadow: 'inset 0 0 0 3px #c23fff48', background: '#db8eff', color: '#ffffff00' };
  const hoverBtnStyle: React.CSSProperties = { background: '#fafafa' };

  // compute clues
  const { rows: rowClues, cols: colClues } = useMemo(() => getClues(puzzle), [puzzle]);

  // cleared: check whether the player's grid exactly matches the puzzle
  // (every puzzle `true` must be filled, and every puzzle `false` must
  // NOT be filled). Previously we only checked that required cells were
  // filled which allowed the user to fill every square and be marked
  // as solved. This stricter check prevents that.
  const cleared = useMemo(() => {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const shouldBeFilled = !!(puzzle && puzzle[r] && puzzle[r][c]);
        const val = (grid && grid[r] && typeof grid[r][c] !== 'undefined') ? Number(grid[r][c]) : 0;
        if (shouldBeFilled) {
          if (val !== 1) return false;
        } else {
          if (val === 1) return false;
        }
      }
    }
    return true;
  }, [puzzle, grid, size]);


// Start timer on mount (and resume) unless puzzle already cleared or in editorMode
useEffect(() => {
  if (editorMode) return;
  if (cleared) return;
  if (!startAnimationDone) return;
  if (timerRef.current) return;
  timerRef.current = window.setInterval(() => setElapsedSec(s => s + 1) as unknown as number, 1000) as unknown as number;
  return () => {
    if (timerRef.current) { window.clearInterval(timerRef.current as unknown as number); timerRef.current = null; }
  };
}, [editorMode, cleared, startAnimationDone]);

  // Persist seconds periodically and on unmount
  useEffect(() => {
    // debounce save every 5s
    if (saveTimerDebounce.current) clearTimeout(saveTimerDebounce.current);
    saveTimerDebounce.current = window.setTimeout(() => {
      try {
        // Only write a local copy periodically; avoid frequent server POSTs.
        try {
          const key = `picross:seconds:${dateStr}:${difficulty}`;
          window.localStorage.setItem(key, String(elapsedSec));
          const pKey = `picross:progress:${dateStr}:${difficulty}`;
          const payload = { grid, complete: cleared, seconds: elapsedSec };
          window.localStorage.setItem(pKey, JSON.stringify(payload));
        } catch (err) {
          console.debug('picross:periodic local save err', err);
        }
      } catch (err) {
        console.debug('save seconds err', err);
      }
    }, 5000) as unknown as number;
    return () => { if (saveTimerDebounce.current) clearTimeout(saveTimerDebounce.current); };
  }, [elapsedSec, difficulty, dateStr, userIsLoggedIn]);

  // When user is logged in, prefer the server-side saved seconds for this date/difficulty
  useEffect(() => {
    if (!userIsLoggedIn) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/picross/progress?date=${dateStr}`);
        if (!res.ok) return;
        const json = await res.json();
        if (!mounted) return;
        let sec = 0;
        if (difficulty === 'easy') sec = Number(json?.easySeconds || 0) || 0;
        if (difficulty === 'medium') sec = Number(json?.mediumSeconds || 0) || 0;
        if (difficulty === 'hard') sec = Number(json?.hardSeconds || 0) || 0;
        // Only update if server has a non-zero seconds or if local is non-zero and server is zero
        setElapsedSec(sec || 0);
      } catch (err) {
        console.debug('fetch server seconds failed', err);
      }
    })();
    return () => { mounted = false; };
  }, [userIsLoggedIn, dateStr, difficulty]);

  // Save immediately (used on visibilitychange/unload) to avoid losing recent seconds
  const saveSecondsNow = async () => {
    try {
      if (userIsLoggedIn) {
        const body: any = { date: dateStr };
        if (difficulty === 'easy') body.easySeconds = elapsedSec;
        if (difficulty === 'medium') body.mediumSeconds = elapsedSec;
        if (difficulty === 'hard') body.hardSeconds = elapsedSec;
        // Include current grid for the active difficulty so the server has
        // the latest state (important when backing out or finishing).
        if (difficulty === 'easy') body.easy = grid;
        if (difficulty === 'medium') body.medium = grid;
        if (difficulty === 'hard') body.hard = grid;
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

  // NOTE: Automatic save on visibilitychange / beforeunload removed to avoid
  // unexpected frequent server POSTs. Server sync now happens on explicit
  // actions only (Back navigation calls `saveSecondsNow()`, and final
  // completion triggers a final save). Periodic/local saves still run.

  // When puzzle is cleared, stop timer and send final time + complete flag to server (so fastest can update)
  useEffect(() => {
    if (!cleared) return;
    // stop timer
    if (timerRef.current) { window.clearInterval(timerRef.current as unknown as number); timerRef.current = null; }
    (async () => {
      try {
        if (userIsLoggedIn) {
          const body: any = { date: dateStr };
          // Include the full grid when reporting completion so the server
          // stores the final solved grid rather than relying on prior
          // partial snapshots.
          if (difficulty === 'easy') { body.easySeconds = elapsedSec; body.easyComplete = true; body.easy = grid; }
          if (difficulty === 'medium') { body.mediumSeconds = elapsedSec; body.mediumComplete = true; body.medium = grid; }
          if (difficulty === 'hard') { body.hardSeconds = elapsedSec; body.hardComplete = true; body.hard = grid; }
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

  const triggerCelebration = async () => {
    if (!cleared) return;
    if (isCelebratingRef.current) return; // already animating
    isCelebratingRef.current = true;

    // clear any existing scheduled timers so we start fresh
    for (const t of celebrationTimeouts.current) {
      try { window.clearTimeout(t); } catch {}
    }
    celebrationTimeouts.current = [];

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

    // pick an ordering sequence for the gold-fill animation
    const pick = pickSequence(filled, size);
    const order = pick.order;
    const seqName = pick.name;
    const isTyler = !!(session?.user?.email && session.user.email.trim().toLowerCase() === "tyler.apsley@gmail.com");
    if (isTyler) console.log('picross: celebration sequence ->', seqName);
    const delay = 60;
    order.forEach(([r, c], i) => {
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

    // schedule guard reset after the animation finishes
    const total = Math.max(500, filled.length * delay + 200);
    const endT = window.setTimeout(() => {
      isCelebratingRef.current = false;
    }, total);
    celebrationTimeouts.current.push(endT as unknown as number);

    // Run personal-best detection in background so animation isn't delayed by network
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
          } catch (err) { /* ignore */ }
        } else {
          try {
            const bestKey = `picross:fastest:${difficulty}`;
            const raw = window.localStorage.getItem(bestKey);
            const n = raw ? (Number(raw) || 0) : 0;
            if (n) prior = n;
          } catch {}
        }
        if (elapsedSec > 0 && (prior === null || elapsedSec < prior)) {
          try { window.localStorage.setItem(`picross:fastest:${difficulty}`, String(elapsedSec)); } catch {}
          setShowNewPB(true);
          if (pbTimeoutRef.current) window.clearTimeout(pbTimeoutRef.current);
          pbTimeoutRef.current = window.setTimeout(() => { setShowNewPB(false); pbTimeoutRef.current = null; }, 8000) as unknown as number;
        }
      } catch (err) { console.debug('picross:detect pb err', err); }
    })();
  };

  useEffect(() => {
    if (!cleared) {
      setCelebrateGrid(null);
      for (const t of celebrationTimeouts.current) {
        try { window.clearTimeout(t); } catch {}
      }
      celebrationTimeouts.current = [];
      isCelebratingRef.current = false;
      return;
    }
    if (cleared) {
      // when cleared becomes true, start celebration if not currently animating
      if (!isCelebratingRef.current) triggerCelebration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleared]);

  // When exiting editor mode, if the puzzle is already cleared, replay celebration
  useEffect(() => {
    if (!editorMode && cleared) {
      triggerCelebration();
    }
  }, [editorMode, cleared]);
  const [saveDate, setSaveDate] = useState("");
  const completeTextRef = useRef<HTMLDivElement | null>(null);
  const completeAnimStartedRef = useRef(false);

  // Animate the "Puzzle Complete!" text when celebration grid becomes active
  useEffect(() => {
    // Only run the entrance animation once when a celebration begins.
    if (!celebrateGrid || !completeTextRef.current) {
      completeAnimStartedRef.current = false;
      return;
    }
    if (completeAnimStartedRef.current) return;
    completeAnimStartedRef.current = true;
    try {
      const el = completeTextRef.current;
      const original = (el.textContent || 'Puzzle Complete!');
      // Replace content with per-letter spans
      const letters: HTMLElement[] = [];
      el.innerHTML = '';
      for (const ch of Array.from(original)) {
        const span = document.createElement('span');
        span.className = 'complete-letter';
        span.style.display = 'inline-block';
        span.style.fontFamily = 'Courier New';
        span.style.transformOrigin = 'center';
        // preserve spaces
        span.textContent = ch === ' ' ? '\u00A0' : ch;
        letters.push(span);
        el.appendChild(span);
      }
      // animate letters with a slight stagger
      gsap.from(letters, {
        scale: 0.35,
        y: 20,
        opacity: 0,
        duration: 0.45,
        ease: 'back.out(1.7)',
        stagger: 0.05,
      });
    } catch (err) {
      console.debug('gsap letter animation failed', err);
    }
  }, [celebrateGrid]);

  

  // Apply action to a specific cell (used by pointer drag)
  const applyActionToCell = (r: number, c: number, action: "fill" | "erase" | "fillX" | "fillMaybe" | "eraseMaybe") => {
    // Prevent changes during celebration to avoid race conditions where
    // rapid pointer input applies after the solved animation and leaves
    // incorrect cells filled.
    if (editorMode) return;
    if (isCelebratingRef.current) return;
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

  const handleClearBoard = async () => {
    // Reset provider progress for this difficulty to all 0s and reset timer
    setPrefetch(prev => ({
      ...prev,
      progress: {
        ...prev.progress,
        [difficulty]: Array.from({ length: size }, () => Array.from({ length: size }, () => 0 as CellState)),
      },
    }));
    try {
      const key = `picross:progress:${dateStr}:${difficulty}`;
      const payload = { grid: Array.from({ length: size }, () => Array.from({ length: size }, () => 0)), complete: false, seconds: 0 };
      try { window.localStorage.setItem(key, JSON.stringify(payload)); } catch {}
      const secKey = `picross:seconds:${dateStr}:${difficulty}`;
      try { window.localStorage.setItem(secKey, String(0)); } catch {}
    } catch {}
    setElapsedSec(0);
    setCelebrateGrid(null);
    // Fire-and-forget server reset for logged-in users
    if (userIsLoggedIn) {
      (async () => {
        try {
          const body: any = { date: dateStr };
          if (difficulty === 'easy') body.easy = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
          if (difficulty === 'medium') body.medium = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
          if (difficulty === 'hard') body.hard = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
          await fetch('/api/picross/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        } catch (err) { console.debug('server clear failed', err); }
      })();
    }
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

  // Debounce save effect (local-only): persist grid changes locally but
  // avoid automatic server POSTs on every interaction. Server sync is
  // performed on explicit actions: Back navigation (`saveSecondsNow()`),
  // final completion effect, or manual saves.
  const debounceTimeout = useRef<number | null>(null);
  useEffect(() => {
    if (editorMode) return;
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = window.setTimeout(() => {
      try {
        const key = `picross:progress:${dateStr}:${difficulty}`;
        const payload = { grid, complete: cleared };
        window.localStorage.setItem(key, JSON.stringify(payload));
      } catch (err) {
        console.debug('localStorage write error', err);
      }
    }, 400); // 400ms debounce
    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [grid, cleared, difficulty, editorMode, dateStr]);

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

  useEffect(() => {
    if (editorMode) {
      setCelebrateGrid(null);
      for (const t of celebrationTimeouts.current) try { window.clearTimeout(t); } catch {};
      celebrationTimeouts.current = [];
    }
  }, [editorMode]);

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
            router.push('/nonogram?replay=1');
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
          clearBoard={handleClearBoard}
          firstStart={firstStart}
          onStartComplete={() => {
            try {
              const shownKey = `picross:startShown:${dateStr}:${difficulty}`;
              window.localStorage.setItem(shownKey, '1');
            } catch {}
            setStartAnimationDone(true);
          }}
      />
      {/* Mode selector bar -> replaced by celebration text when animation starts */}
      {celebrateGrid && !editorMode ? (
        <div style={{ marginTop: 18, width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div ref={completeTextRef} style={{ background: 'transparent', color: '#5a2b8a', fontWeight: 800, fontSize: 24, padding: '12px 16px', borderRadius: 8, textShadow: '0 2px 6px rgba(0,0,0,0.08)', transformOrigin: 'center' }}>
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
            celebrateGrid={celebrateGrid ? true : null}
            clearBoard={handleClearBoard}
            
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
