// Moved PicrossPage implementation here from page.tsx
"use client";
import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { CellState, type PrefetchState, type PrefetchShape } from "../PicrossPrefetchContext";
import { usePicrossPrefetch } from "../PicrossPrefetchContext";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import GridBoard from '../components/GridBoard';
import Controls from '../components/Controls';
import { getMSTDateString } from '../time';
import { getPicrossSettings } from '../settings';
import { storageKeys } from '../storageKeys';
import { ADMIN_EMAIL } from '../../../lib/constants';
import { useTimer } from '../hooks/useTimer';
import { useCelebration } from '../hooks/useCelebration';
import { usePointerDrag } from '../hooks/usePointerDrag';
import { useEditorMode } from '../hooks/useEditorMode';
import { createEmptyGrid, computeClues } from '../runUtils';

const DIFFICULTY_CONFIG: Record<string, { size: number; leftWidthPx: number; topHeightPx: number; clueFontPx: number; cellPxDefault?: number; autoScaleEnabled?: boolean; minCellPx?: number; maxCellPx?: number; minClueFontPx?: number; clueGap?: number }> = {
  easy:   { size: 5,  leftWidthPx: 100, topHeightPx: 100, clueFontPx: 20, cellPxDefault: 32, autoScaleEnabled: false, minCellPx: 12, maxCellPx: 48, minClueFontPx: 12, clueGap: 12 },
  medium: { size: 10, leftWidthPx: 125, topHeightPx: 125, clueFontPx: 16, cellPxDefault: 28, autoScaleEnabled: false, minCellPx: 10, maxCellPx: 40, minClueFontPx: 11, clueGap: 12 },
  hard:   { size: 15, leftWidthPx: 125, topHeightPx: 125, clueFontPx: 9,  cellPxDefault: 24, autoScaleEnabled: true,  minCellPx: 19, maxCellPx: 25, minClueFontPx: 10, clueGap: 8  },
};

function getDefaultPuzzle(size: number): boolean[][] {
  return createEmptyGrid(size, false);
}

function getCompleteMessage(
  isFirstSolveToday: boolean,
  isFastestToday: boolean,
  isFaster: boolean,
): string {
  if (isFirstSolveToday) return 'First solve today!';
  if (isFastestToday) return 'Fastest solve today!';
  if (isFaster) return `Faster than today's average!`;
  return 'Puzzle Complete!';
}

function detectFirstStart(
  dateStr: string,
  difficulty: string,
  effectiveProgress: Record<string, CellState[][]> | null | undefined,
): boolean {
  // Any non-zero cell or recorded seconds counts as prior progress
  let hasProgress = !!(effectiveProgress?.[difficulty]?.some(row => row.some(v => Number(v) !== 0)));
  if (!hasProgress) {
    try {
      const secVal = Number(
        typeof window !== 'undefined' ? window.localStorage.getItem(storageKeys.seconds(dateStr, difficulty)) : null
      ) || 0;
      if (secVal > 0) {
        hasProgress = true;
      } else {
        try {
          const rawProg = typeof window !== 'undefined' ? window.localStorage.getItem(storageKeys.progress(dateStr, difficulty)) : null;
          if (rawProg) {
            const parsed = JSON.parse(rawProg) as { seconds?: number } | null;
            if (parsed && typeof parsed.seconds === 'number' && parsed.seconds > 0) hasProgress = true;
          }
        } catch {}
      }
    } catch {}
  }
  if (hasProgress) return false;
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(storageKeys.startShown(dateStr, difficulty)) : null;
    if (raw === '1') return false;
  } catch {}
  try {
    const settings = typeof window !== 'undefined' ? getPicrossSettings() : { playStartAnimation: true, showTimer: true };
    if (settings?.playStartAnimation === false) return false;
  } catch {}
  return true;
}

const DEFAULT_FONT = "var(--font-courier-prime), 'Courier New', monospace";

function PicrossPlayInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { puzzle: prefetchPuzzle, progress: prefetchProgress, setPrefetch } = usePicrossPrefetch();

  // Freeze dateStr at mount so a midnight rollover does not switch puzzles mid-session
  const [dateStr] = useState<string>(() => (searchParams?.get?.('date')) || getMSTDateString());
  const [isPastPuzzle] = useState<boolean>(() => dateStr !== getMSTDateString());
  const fromCalendar = searchParams?.get?.('fromCalendar') ?? null;

  // Local state for past-puzzle data — never written to the shared context so the
  // splash-page difficulty icons always reflect today's progress, not a past day's.
  const [pastData, setPastData] = useState<{ puzzle: Record<string, boolean[][]>; progress: Record<string, CellState[][]> }>({ puzzle: {}, progress: {} });

  // Route all setPrefetch calls through local state when viewing a past puzzle.
  // This prevents usePointerDrag / useCelebration from polluting the shared context.
  const effectiveSetPrefetch = useCallback((v: Parameters<PrefetchShape['setPrefetch']>[0]) => {
    if (isPastPuzzle) {
      setPastData(prev => {
        const patch = typeof v === 'function'
          ? (v as (p: PrefetchState) => Partial<PrefetchState>)({ puzzle: prev.puzzle, progress: prev.progress } as PrefetchState)
          : v;
        return {
          puzzle: { ...prev.puzzle, ...(patch.puzzle ?? {}) },
          progress: { ...prev.progress, ...(patch.progress ?? {}) },
        };
      });
    } else {
      setPrefetch(v);
    }
  }, [isPastPuzzle, setPrefetch]);

  const effectivePuzzle = isPastPuzzle ? pastData.puzzle : prefetchPuzzle;
  const effectiveProgress = isPastPuzzle ? pastData.progress : prefetchProgress;

  let formattedDate = dateStr;
  try {
    const parts = (dateStr || '').split('-');
    if (parts.length === 3) {
      const local = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      formattedDate = local.toLocaleDateString();
    } else {
      formattedDate = new Date(dateStr).toLocaleDateString();
    }
  } catch {
    try { formattedDate = new Date(dateStr).toLocaleDateString(); } catch { formattedDate = dateStr; }
  }

  const difficulty = ((searchParams?.get?.('difficulty')) || 'easy') as string;
  const size = DIFFICULTY_CONFIG[difficulty]?.size ?? 5;

  const puzzle = (effectivePuzzle?.[difficulty]) ?? getDefaultPuzzle(size);
  // Use length check rather than ?? so that an empty array [] (null progress from DB)
  // falls through to createEmptyGrid the same as null/undefined would.
  const rawGrid = effectiveProgress?.[difficulty];
  const grid: CellState[][] = (Array.isArray(rawGrid) && rawGrid.length > 0) ? rawGrid : createEmptyGrid(size, CellState.EMPTY);

  const [startAnimationDone, setStartAnimationDone] = useState<boolean>(() => !detectFirstStart(dateStr, difficulty, effectiveProgress));
  // For past puzzles: show a loading overlay until we've confirmed the correct puzzle is in context.
  const [pastPuzzleLoaded, setPastPuzzleLoaded] = useState(!isPastPuzzle);
  const [replayMode, setReplayMode] = useState(false);
  const userIsLoggedIn = !!session?.user?.email;

  const [inputMode, setInputMode] = useState<'fill' | 'maybe' | 'x'>('fill');

  // Solved state: every required cell filled, no incorrectly filled cells
  const cleared = useMemo(() => {
    // Guard against empty/loading puzzle — an all-false puzzle trivially satisfies
    // the loop below (nothing needs to be filled), causing a spurious cleared=true
    // before actual puzzle data has loaded.
    if (!puzzle.some(row => row.some(Boolean))) return false;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const shouldBeFilled = !!(puzzle[r]?.[c]);
        const val = grid[r]?.[c] ?? CellState.EMPTY;
        if (shouldBeFilled) { if (val !== CellState.FILLED) return false; }
        else { if (val === CellState.FILLED) return false; }
      }
    }
    return true;
  }, [puzzle, grid, size]);

  // Only allow the completion save to fire when cleared transitions from false→true.
  // Without this, a stale context (yesterday's solved grid still loaded) or the brief
  // loading state (all-false default puzzle) would cause cleared=true on mount and
  // trigger a spurious save for today's date with elapsedSec=0.
  const clearedWasFalseRef = useRef<boolean>(!cleared);

  const isAdmin = (session?.user?.email ?? '').trim().toLowerCase() === ADMIN_EMAIL;
  const isEditorAllowed = isAdmin;

  // ------ Custom hooks ------
  const {
    editorMode,
    editorPuzzle,
    setEditorPuzzle,
    saveDate,
    setSaveDate,
    handleSave,
    handleNextDate,
    handlePrevDate,
    handleClearEditor,
    activateEditorMode,
    deactivateEditorMode,
  } = useEditorMode({ isEditorAllowed, size, difficulty, prefetchPuzzle: effectivePuzzle, setPrefetch: effectiveSetPrefetch });

  const { elapsedSec, setElapsedSec, saveSecondsNow } = useTimer({
    dateStr, difficulty, userIsLoggedIn, startAnimationDone, cleared, editorMode, grid,
    disableSave: isPastPuzzle && replayMode,
  });

  const {
    celebrateGrid,
    setCelebrateGrid,
    showNewPB,
    isCelebratingRef,
    triggerCelebration,
    clearCelebration,
    completeTextRef,
    solveStreak,
    solveAvg,
    solveDistribution,
    statsSettled,
    fillAnimDone,
  } = useCelebration({
    cleared, elapsedSec, grid, puzzle, size, difficulty, userIsLoggedIn, isAdmin, setPrefetch: effectiveSetPrefetch,
  });

  const { pointerActiveRef, pointerActionRef, applyActionToCell } = usePointerDrag({
    editorMode, startAnimationDone, cleared, isCelebratingRef, size, difficulty, setPrefetch: effectiveSetPrefetch,
  });

  // ------ Layout state ------
  const [minClueFontPx, setMinClueFontPx] = useState<number>(10);
  const CLUE_FONT_PX = Math.max((DIFFICULTY_CONFIG[difficulty]?.clueFontPx ?? 18), minClueFontPx);
  const clueGap = DIFFICULTY_CONFIG[difficulty]?.clueGap ?? 12;
  const topHeight = DIFFICULTY_CONFIG[difficulty]?.topHeightPx ?? 120;
  const leftWidth = DIFFICULTY_CONFIG[difficulty]?.leftWidthPx ?? 120;
  const [cellPx, setCellPx] = useState<number>(32);
  const [autoScaleEnabled, setAutoScaleEnabled] = useState<boolean>(true);
  const [minCellPx, setMinCellPx] = useState<number>(12);
  const [maxCellPx, setMaxCellPx] = useState<number>(48);
  const [fontFamily] = useState<string>(DEFAULT_FONT);
  const fontWeight = 700;

  useEffect(() => {
    try {
      const cfg = DIFFICULTY_CONFIG[difficulty] ?? DIFFICULTY_CONFIG['easy'];
      if (cfg.cellPxDefault) setCellPx(cfg.cellPxDefault);
      if (typeof cfg.autoScaleEnabled !== 'undefined') setAutoScaleEnabled(cfg.autoScaleEnabled as boolean);
      if (cfg.minCellPx) setMinCellPx(cfg.minCellPx);
      if (cfg.maxCellPx) setMaxCellPx(cfg.maxCellPx);
      if (cfg.minClueFontPx) setMinClueFontPx(cfg.minClueFontPx);
    } catch {}
    const compute = () => {
      try {
        const avail = Math.max(120, window.innerWidth - 32 - leftWidth - 24);
        const candidate = Math.floor(avail / size);
        const newPx = Math.max(minCellPx ?? 12, Math.min(maxCellPx ?? 48, candidate || (minCellPx ?? 12)));
        if (autoScaleEnabled && difficulty === 'hard') setCellPx(newPx);
      } catch {}
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [difficulty, leftWidth, size, autoScaleEnabled, minCellPx, maxCellPx]);

  useEffect(() => {
    const calc = () => {
      try {
        const slots = Math.min(5, size);
        const denom = size + slots;
        const cellPxW = Math.floor((window.innerWidth - 32) / denom);
        const cellPxH = Math.floor((window.innerHeight - 140) / denom);
        const px = Math.max(16, Math.min(40, Math.max(8, Math.min(cellPxW, cellPxH))));
        setCellPx(px);
      } catch { setCellPx(40); }
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [size]);

  // ------ Clues ------
  const { rows: rowClues, cols: colClues } = useMemo(() => computeClues(puzzle), [puzzle]);

  // ------ Grid helpers ------
  const isFilledCell = (r: number, c: number): boolean => {
    if (editorMode) {
      const p = editorPuzzle ?? ((prefetchPuzzle?.[difficulty]) ?? getDefaultPuzzle(size));
      return !!(p?.[r]?.[c]);
    }
    return grid?.[r]?.[c] === CellState.FILLED;
  };

  const isXCell = (r: number, c: number): boolean => {
    if (editorMode) return false;
    return grid?.[r]?.[c] === CellState.X;
  };

  const getRunsForRow = (r: number): number[] => {
    const runs: number[] = [];
    let count = 0;
    for (let c = 0; c < size; c++) {
      if (isFilledCell(r, c)) count++;
      else if (count) { runs.push(count); count = 0; }
    }
    if (count) runs.push(count);
    return runs;
  };

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
        runs.push({ len: count, start, end, bounded: (start === 0 || isXCell(r, start - 1)) && (end === size - 1 || isXCell(r, end + 1)) });
        count = 0;
      }
    }
    if (count) {
      const end = size - 1;
      runs.push({ len: count, start, end, bounded: (start === 0 || isXCell(r, start - 1)) && (end === size - 1 || isXCell(r, end + 1)) });
    }
    return runs;
  };

  const getRunsForCol = (c: number): number[] => {
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
        runs.push({ len: count, start, end, bounded: (start === 0 || isXCell(start - 1, c)) && (end === size - 1 || isXCell(end + 1, c)) });
        count = 0;
      }
    }
    if (count) {
      const end = size - 1;
      runs.push({ len: count, start, end, bounded: (start === 0 || isXCell(start - 1, c)) && (end === size - 1 || isXCell(end + 1, c)) });
    }
    return runs;
  };

  // ------ Handlers ------
  const fmtTime = (sec: number) => { const m = Math.floor(sec / 60); const s = sec % 60; return `${m}:${s.toString().padStart(2, '0')}`; };

  // Derive "others" once — exclude own entry so comparisons are against other solvers
  const otherSolveTimes = useMemo(() => {
    if (elapsedSec <= 0) return solveDistribution;
    const idx = solveDistribution.indexOf(elapsedSec);
    return idx === -1 ? solveDistribution : solveDistribution.filter((_, i) => i !== idx);
  }, [solveDistribution, elapsedSec]);

  const isFirstSolveToday = userIsLoggedIn && elapsedSec > 0 && otherSolveTimes.length === 0;
  const isFastestToday = userIsLoggedIn && elapsedSec > 0 && otherSolveTimes.length > 0 && elapsedSec <= Math.min(...otherSolveTimes);
  const isFaster = userIsLoggedIn && solveAvg !== null && elapsedSec > 0 && elapsedSec < solveAvg;

  const completeMessage = getCompleteMessage(isFirstSolveToday, isFastestToday, isFaster);
  const avgLine = isFaster && !isFirstSolveToday && !isFastestToday && solveAvg !== null ? `(${fmtTime(solveAvg)})` : null;

  // For past puzzles suppress the social/competitive elements — just show "Puzzle Complete!"
  const displayCompleteMessage = isPastPuzzle ? 'Puzzle Complete!' : completeMessage;
  const displayAvgLine = isPastPuzzle ? null : avgLine;

  // Emoji percentile bar — exclude own time so comparison is against other solvers
  const emojiBar = useMemo(() => {
    if (isPastPuzzle) return '';
    if (!userIsLoggedIn) return '';
    if (elapsedSec <= 0) return '';
    if (otherSolveTimes.length === 0) return '';
    const BLOCKS = 10;
    // Match histogram orientation: left = fast, right = slow
    const fasterThanMe = otherSolveTimes.filter(t => t < elapsedSec).length;
    const yellowIdx = Math.round((fasterThanMe / otherSolveTimes.length) * (BLOCKS - 1));
    return Array.from({ length: BLOCKS }, (_, i) => i === yellowIdx ? '🟨' : '🟪').join('');
  }, [isPastPuzzle, userIsLoggedIn, elapsedSec, otherSolveTimes]);

  const [copied, setCopied] = useState<boolean>(false);

  const handleShare = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parts = dateStr.split('-');
    const shortDate = parts.length === 3
      ? `${months[Number(parts[1]) - 1]} ${Number(parts[2])}`
      : formattedDate;
    const diffLabel = difficulty === 'easy' ? 'Easy (5×5)' : difficulty === 'medium' ? 'Medium (10×10)' : 'Hard (15×15)';
    const mins = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;
    const timeStr = elapsedSec > 0 ? `⏱ ${mins}:${secs.toString().padStart(2, '0')}` : null;
    const streakStr = solveStreak > 0 ? `🔥 Streak: ${solveStreak}` : null;
    const timeLine = [timeStr].filter(Boolean).join(' | ');

    const lines = [
      `Daily Nonogram — ${shortDate}`,
      diffLabel,
      timeLine || null,
      emojiBar || null,
      'tapsley.space/nonogram',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => { /* clipboard unavailable */ });
  };

  const handleReplay = () => {
    setReplayMode(true);
    effectiveSetPrefetch(prev => ({
      ...prev,
      progress: { ...prev.progress, [difficulty]: createEmptyGrid(size, CellState.EMPTY) },
    }));
    setElapsedSec(0);
    clearCelebration();
  };

  const handleClearBoard = () => {
    effectiveSetPrefetch(prev => ({
      ...prev,
      progress: {
        ...prev.progress,
        [difficulty]: createEmptyGrid(size, CellState.EMPTY),
      },
    }));
    try {
      window.localStorage.setItem(
        storageKeys.progress(dateStr, difficulty),
        JSON.stringify({ grid: createEmptyGrid(size, CellState.EMPTY), complete: false }),
      );
    } catch {}
    clearCelebration();
    if (userIsLoggedIn) {
      (async () => {
        try {
          const body: Record<string, unknown> = { date: dateStr };
          if (difficulty === 'easy') body.easy = createEmptyGrid(size, CellState.EMPTY);
          if (difficulty === 'medium') body.medium = createEmptyGrid(size, CellState.EMPTY);
          if (difficulty === 'hard') body.hard = createEmptyGrid(size, CellState.EMPTY);
          await fetch('/api/picross/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        } catch (err) { console.debug('server clear failed', err); }
      })();
    }
  };

  // ------ Bridging effects ------

  // Clear celebration when entering editor mode
  useEffect(() => {
    if (editorMode) clearCelebration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorMode]);

  // Replay celebration when returning to play mode if already solved
  useEffect(() => {
    if (!editorMode && cleared) triggerCelebration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorMode]);

  // Final completion save (with complete flags) when puzzle is first solved
  useEffect(() => {
    if (!cleared) {
      clearedWasFalseRef.current = true;
      return;
    }
    if (!clearedWasFalseRef.current) return;
    if (isPastPuzzle && replayMode) return;
    (async () => {
      try {
        if (userIsLoggedIn) {
          const body: Record<string, unknown> = { date: dateStr };
          if (difficulty === 'easy') { if (elapsedSec > 0) body.easySeconds = elapsedSec; body.easyComplete = true; body.easy = grid; }
          if (difficulty === 'medium') { if (elapsedSec > 0) body.mediumSeconds = elapsedSec; body.mediumComplete = true; body.medium = grid; }
          if (difficulty === 'hard') { if (elapsedSec > 0) body.hardSeconds = elapsedSec; body.hardComplete = true; body.hard = grid; }
          try {
            await fetch('/api/picross/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          } catch (err) { console.debug('picross:final server save failed', err); }
          try {
            window.localStorage.setItem(storageKeys.seconds(dateStr, difficulty), String(elapsedSec));
            window.localStorage.setItem(storageKeys.progress(dateStr, difficulty), JSON.stringify({ grid, complete: true, seconds: elapsedSec }));
          } catch (err) { console.debug('picross:final local save err', err); }
        } else {
          try {
            window.localStorage.setItem(storageKeys.seconds(dateStr, difficulty), String(elapsedSec));
            try {
              const bestKey = storageKeys.fastest(difficulty);
              const existing = Number(window.localStorage.getItem(bestKey) || 0) || 0;
              if (!existing || elapsedSec < existing) window.localStorage.setItem(bestKey, String(elapsedSec));
            } catch {}
            try {
              window.localStorage.setItem(storageKeys.progress(dateStr, difficulty), JSON.stringify({ grid, complete: true, seconds: elapsedSec }));
            } catch (err) { console.debug('picross:final save progress payload err', err); }
          } catch (err) { console.debug('picross:final save seconds err', err); }
        }
      } catch (err) { console.debug('final save err', err); }
    })();
  }, [cleared]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced local grid snapshot (not completion)
  const debounceTimeout = useRef<number | null>(null);
  useEffect(() => {
    if (editorMode) return;
    if (isPastPuzzle && replayMode) return;
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = window.setTimeout(() => {
      try {
        // Preserve any existing seconds so the debounce doesn't strip them after
        // the completion save has already written { grid, complete: true, seconds }.
        const key = storageKeys.progress(dateStr, difficulty);
        const payload: { grid: unknown; complete: boolean; seconds?: number } = { grid, complete: cleared };
        try {
          const existing = window.localStorage.getItem(key);
          if (existing) {
            const parsed = JSON.parse(existing) as { seconds?: number } | null;
            if (parsed && typeof parsed.seconds === 'number' && parsed.seconds > 0) payload.seconds = parsed.seconds;
          }
        } catch {}
        window.localStorage.setItem(key, JSON.stringify(payload));
      } catch (err) { console.debug('localStorage write error', err); }
    }, 400) as unknown as number;
    return () => { if (debounceTimeout.current) clearTimeout(debounceTimeout.current); };
  }, [grid, cleared, difficulty, editorMode, dateStr, replayMode]);

  // For past puzzles: always fetch the correct puzzle + progress from the server.
  // Store result in local pastData (NOT the shared context) so splash-page icons
  // always reflect today's progress, not a past day's.
  useEffect(() => {
    if (!isPastPuzzle) return;
    (async () => {
      try {
        const [puzRes, progRes] = await Promise.all([
          fetch(`/api/picross/puzzle?date=${dateStr}`),
          fetch(`/api/picross/progress?date=${dateStr}`),
        ]);
        const puzData = puzRes.ok ? await puzRes.json() : null;
        const progData = progRes.ok ? await progRes.json() : null;
        setPastData({
          puzzle:   { easy: puzData?.easy   ?? [], medium: puzData?.medium   ?? [], hard: puzData?.hard   ?? [] },
          progress: { easy: progData?.easy  ?? [], medium: progData?.medium  ?? [], hard: progData?.hard  ?? [] },
        });
        // If this past puzzle is already solved, skip the START screen and go
        // straight to the celebration. We must check completion here against the
        // freshly fetched data because `cleared` (a useMemo) hasn't re-run yet.
        try {
          const diff = (searchParams?.get?.('difficulty')) || 'easy';
          const puz: boolean[][] = puzData?.[diff] ?? [];
          const prog: number[][] = progData?.[diff] ?? [];
          const isCleared = puz.length > 0 && puz.every((row, r) =>
            row.every((cell, c) => {
              const val = Number(prog?.[r]?.[c] ?? 0);
              return cell ? val === CellState.FILLED : val !== CellState.FILLED;
            })
          );
          if (isCleared) {
            setStartAnimationDone(true);
            // Defer so useCelebration's clearedRef has time to update
            setTimeout(() => { try { triggerCelebration(); } catch {} }, 50);
          }
        } catch {}
        setPastPuzzleLoaded(true);
      } catch (err) { console.debug('past puzzle load err', err); setPastPuzzleLoaded(true); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="nonogram-root" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', marginTop: 0, background: '#cca3ff', width: '100%', overflow: 'hidden', paddingTop: 15, colorScheme: 'light' }}>
      {isPastPuzzle && !pastPuzzleLoaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#cca3ff', zIndex: 50 }}>
          <style>{`@keyframes past-spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ width: 44, height: 44, borderRadius: '50%', border: '5px solid rgba(90,43,138,0.25)', borderTopColor: '#5a2b8a', animation: 'past-spin 0.8s linear infinite' }} />
        </div>
      )}
      <div style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 15, paddingRight: 15, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={async () => {
              try { await saveSecondsNow(); } catch (err) { console.debug('picross:save on back err', err); }
              if (fromCalendar) {
                router.push(`/nonogram?openCalendar=${fromCalendar}`);
              } else {
                router.push('/nonogram?replay=1');
              }
            }}
            aria-label="Back"
            style={{ color: '#000', background: 'transparent', border: 'none', padding: '0px 0px', margin: 0, fontSize: 36, lineHeight: 1, cursor: 'pointer', fontWeight: 800, position: 'relative',  left: '7px' }}
          >
            ‹
          </button>
          <h2 style={{ color: '#000', margin: 5, paddingLeft: 20, fontFamily: DEFAULT_FONT, fontWeight: '500', fontSize: 25 }}>{formattedDate}</h2>
        </div>
      </div>

      {(!isPastPuzzle || pastPuzzleLoaded) && <GridBoard
        layout={{ size, leftWidth, topHeight, cellPx, CLUE_FONT_PX, clueGap, fontFamily, fontWeight }}
        editor={{ editorMode, activateEditorMode, deactivateEditorMode, editorPuzzle, setEditorPuzzle, isEditorAllowed }}
        prefetch={{ prefetchPuzzle: effectivePuzzle, prefetchProgress: effectiveProgress, setPrefetch: effectiveSetPrefetch, difficulty }}
        pointer={{ pointerActiveRef, pointerActionRef, applyActionToCell, inputMode }}
        clues={{ rowClues, colClues, getRunsForCol, getRunsMetaForCol, getRunsForRow, getRunsMetaForRow, isFilledCell, isXCell }}
        puzzle={puzzle}
        grid={grid}
        elapsedSec={elapsedSec}
        cleared={cleared}
        //showNewPB={showNewPB}
        showNewPB={false}
        celebrateGrid={celebrateGrid}
        firstStart={!startAnimationDone}
        onStartComplete={() => {
          try { window.localStorage.setItem(storageKeys.startShown(dateStr, difficulty), '1'); } catch {}
          setStartAnimationDone(true);
        }}
        setSaveDate={setSaveDate}
        showTimer={(typeof window === 'undefined') ? true : (getPicrossSettings().showTimer !== false)}
      />}

      {cleared && !editorMode ? (
        <div style={{ marginTop: 4, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          <div ref={completeTextRef} style={{ background: 'transparent', color: '#5a2b8a', fontWeight: 800, padding: '12px 16px 4px', borderRadius: 8, wordBreak: 'keep-all', textShadow: '0 2px 6px rgba(0,0,0,0.08)', transformOrigin: 'center', opacity: statsSettled && fillAnimDone ? undefined : 0 }}>
            {displayCompleteMessage}
          </div>
          {displayAvgLine && statsSettled && fillAnimDone && (
            <div style={{ color: '#5a2b8a', fontWeight: 600, fontSize: 14, opacity: 0.8, marginBottom: 2, textAlign: 'center', animation: 'fade-in-up 0.5s ease 1.65s both' }}>
              {displayAvgLine}
            </div>
          )}
          {emojiBar && statsSettled && fillAnimDone && (
            <div style={{ fontSize: 22, letterSpacing: 2, marginBottom: 4, display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
              <style>{`
                @keyframes emoji-bounce-in {
                  0%   { opacity: 0; transform: scale(0.3) translateY(8px); }
                  60%  { transform: scale(1.25) translateY(-4px); }
                  80%  { transform: scale(0.95) translateY(1px); }
                  100% { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes fade-in-up {
                  from { opacity: 0; transform: translateY(6px); }
                  to   { opacity: 0.8; transform: translateY(0); }
                }
              `}</style>
              {Array.from(emojiBar).map((ch, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    animation: `emoji-bounce-in 0.4s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.06}s both`,
                  }}
                >
                  {ch}
                </span>
              ))}
            </div>
          )}
          {isPastPuzzle ? (
            <button
              onClick={handleReplay}
              style={{ fontFamily: DEFAULT_FONT, fontWeight: 700, fontSize: 15, padding: '8px 22px', borderRadius: 8, border: '2px solid #5a2b8a', background: '#fff', color: '#5a2b8a', cursor: 'pointer', letterSpacing: 0.5 }}
            >
              ↩ Replay
            </button>
          ) : (
            <button
              onClick={handleShare}
              style={{ fontFamily: DEFAULT_FONT, fontWeight: 700, fontSize: 15, padding: '8px 22px', borderRadius: 8, border: '2px solid #5a2b8a', background: copied ? '#5a2b8a' : '#fff', color: copied ? '#fff' : '#5a2b8a', cursor: 'pointer', transition: 'background 0.2s, color 0.2s', letterSpacing: 0.5 }}
            >
              {copied ? '✓ Copied!' : '📋 Share'}
            </button>
          )}
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
          celebrateGrid={celebrateGrid ? true : null}
          clearBoard={handleClearBoard}
        />
      )}
    </div>
  );
}

function PicrossPageInner() {
  const searchParams = useSearchParams();
  const date = searchParams?.get('date') ?? 'today';
  const difficulty = searchParams?.get('difficulty') ?? 'easy';
  return <PicrossPlayInner key={`${date}-${difficulty}`} />;
}

export default function PicrossPage() {
  return (
    <React.Suspense fallback={<div>Loading Nonogram...</div>}>
      <PicrossPageInner />
    </React.Suspense>
  );
}
