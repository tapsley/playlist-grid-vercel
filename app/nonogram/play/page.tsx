// Moved PicrossPage implementation here from page.tsx
"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import type { CellState } from "../PicrossPrefetchContext";
import { usePicrossPrefetch } from "../PicrossPrefetchContext";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import GridBoard from '../components/GridBoard';
import Controls from '../components/Controls';
import { getMSTDateString } from '../time';
import { getPicrossSettings } from '../settings';
import { ADMIN_EMAIL } from '../../../lib/constants';
import { useTimer } from '../hooks/useTimer';
import { useCelebration } from '../hooks/useCelebration';
import { usePointerDrag } from '../hooks/usePointerDrag';
import { useEditorMode } from '../hooks/useEditorMode';

const DIFFICULTY_CONFIG: Record<string, { size: number; leftWidthPx: number; topHeightPx: number; clueFontPx: number; cellPxDefault?: number; autoScaleEnabled?: boolean; minCellPx?: number; maxCellPx?: number; minClueFontPx?: number; clueGap?: number }> = {
  easy:   { size: 5,  leftWidthPx: 100, topHeightPx: 100, clueFontPx: 20, cellPxDefault: 32, autoScaleEnabled: false, minCellPx: 12, maxCellPx: 48, minClueFontPx: 12, clueGap: 12 },
  medium: { size: 10, leftWidthPx: 125, topHeightPx: 125, clueFontPx: 16, cellPxDefault: 28, autoScaleEnabled: false, minCellPx: 10, maxCellPx: 40, minClueFontPx: 11, clueGap: 12 },
  hard:   { size: 15, leftWidthPx: 125, topHeightPx: 125, clueFontPx: 9,  cellPxDefault: 24, autoScaleEnabled: true,  minCellPx: 19, maxCellPx: 25, minClueFontPx: 10, clueGap: 8  },
};

function getDefaultPuzzle(size: number): boolean[][] {
  return Array(size).fill(0).map(() => Array(size).fill(false));
}

function getClues(puzzle: boolean[][]) {
  const rows = puzzle.map(row => {
    const clues: number[] = [];
    let count = 0;
    for (const cell of row) {
      if (cell) count++;
      else if (count) { clues.push(count); count = 0; }
    }
    if (count) clues.push(count);
    return clues.length ? clues : [0];
  });
  const cols: number[][] = [];
  for (let c = 0; c < puzzle[0].length; c++) {
    const clues: number[] = [];
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

const DEFAULT_FONT = "var(--font-courier-prime), 'Courier New', monospace";

function PicrossPlayInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { puzzle: prefetchPuzzle, progress: prefetchProgress, setPrefetch } = usePicrossPrefetch();

  // Freeze dateStr at mount so a midnight rollover does not switch puzzles mid-session
  const [dateStr] = useState<string>(() => (searchParams?.get?.('date')) || getMSTDateString());

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

  const puzzle = (prefetchPuzzle?.[difficulty]) ?? getDefaultPuzzle(size);
  const grid: CellState[][] = (prefetchProgress?.[difficulty]) ?? Array.from({ length: size }, () => Array.from({ length: size }, () => 0 as CellState));

  // Determine first-start: any non-zero cell or recorded seconds counts as prior progress
  let hasProgress = !!(prefetchProgress?.[difficulty]?.some(row => row.some(v => Number(v) !== 0)));
  try {
    const secKey = `picross:seconds:${dateStr}:${difficulty}`;
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(secKey) : null;
    const secVal = raw ? Number(raw) || 0 : 0;
    if (secVal > 0) {
      hasProgress = true;
    } else {
      try {
        const progKey = `picross:progress:${dateStr}:${difficulty}`;
        const rawProg = typeof window !== 'undefined' ? window.localStorage.getItem(progKey) : null;
        if (rawProg) {
          const parsed = JSON.parse(rawProg) as { seconds?: number } | null;
          if (parsed && typeof parsed.seconds === 'number' && parsed.seconds > 0) hasProgress = true;
        }
      } catch {}
    }
  } catch {}

  let firstStart = !hasProgress;
  try {
    const shownKey = `picross:startShown:${dateStr}:${difficulty}`;
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(shownKey) : null;
    if (raw === '1') firstStart = false;
  } catch {}
  try {
    const settings = typeof window !== 'undefined' ? getPicrossSettings() : { playStartAnimation: true, showTimer: true };
    if (settings?.playStartAnimation === false) firstStart = false;
  } catch {}

  const [startAnimationDone, setStartAnimationDone] = useState<boolean>(() => !firstStart);
  const userIsLoggedIn = !!session?.user?.email;

  const [inputMode, setInputMode] = useState<'fill' | 'maybe' | 'x'>('fill');

  // Solved state: every required cell filled, no incorrectly filled cells
  const cleared = useMemo(() => {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const shouldBeFilled = !!(puzzle[r]?.[c]);
        const val = typeof grid[r]?.[c] !== 'undefined' ? Number(grid[r][c]) : 0;
        if (shouldBeFilled) { if (val !== 1) return false; }
        else { if (val === 1) return false; }
      }
    }
    return true;
  }, [puzzle, grid, size]);

  const isAdmin = (session?.user?.email ?? '').trim().toLowerCase() === ADMIN_EMAIL;
  const isEditorAllowed = isAdmin;

  // ------ Custom hooks ------
  const {
    editorMode,
    setEditorMode,
    editorPuzzle,
    setEditorPuzzle,
    saveDate,
    setSaveDate,
    handleSave,
    handleNextDate,
    handlePrevDate,
    handleClearEditor,
    findNextAbort,
  } = useEditorMode({ isEditorAllowed, size, difficulty, prefetchPuzzle, setPrefetch });

  const { elapsedSec, saveSecondsNow } = useTimer({
    dateStr, difficulty, userIsLoggedIn, startAnimationDone, cleared, editorMode, grid,
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
    statsSettled,
    fillAnimDone,
  } = useCelebration({
    cleared, elapsedSec, grid, puzzle, size, difficulty, userIsLoggedIn, isAdmin, setPrefetch,
  });

  const { pointerActiveRef, pointerActionRef, applyActionToCell } = usePointerDrag({
    editorMode, startAnimationDone, cleared, isCelebratingRef, size, difficulty, setPrefetch,
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
  const { rows: rowClues, cols: colClues } = useMemo(() => getClues(puzzle), [puzzle]);

  // ------ Grid helpers ------
  const isFilledCell = (r: number, c: number): boolean => {
    if (editorMode) {
      const p = editorPuzzle ?? ((prefetchPuzzle?.[difficulty]) ?? getDefaultPuzzle(size));
      return !!(p?.[r]?.[c]);
    }
    return Number(grid?.[r]?.[c]) === 1;
  };

  const isXCell = (r: number, c: number): boolean => {
    if (editorMode) return false;
    return Number(grid?.[r]?.[c]) === 3;
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
  const completeMessage = (solveAvg !== null && elapsedSec > 0 && elapsedSec < solveAvg)
    ? `Faster than today's average player! (${fmtTime(solveAvg)})`
    : 'Puzzle Complete!';

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
    const avgStr = solveAvg !== null && elapsedSec > 0 && elapsedSec < solveAvg ? `faster than average -> ${fmtTime(solveAvg)}` : null;
    const timeLine = [timeStr].filter(Boolean).join(' | ');
    const lines = [
      `Daily Nonogram — ${shortDate}`,
      diffLabel,
      timeLine || null,
      'tapsley.space/nonogram',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => { /* clipboard unavailable */ });
  };

  const handleClearBoard = () => {
    setPrefetch(prev => ({
      ...prev,
      progress: {
        ...prev.progress,
        [difficulty]: Array.from({ length: size }, () => Array.from({ length: size }, () => 0 as CellState)),
      },
    }));
    try {
      window.localStorage.setItem(
        `picross:progress:${dateStr}:${difficulty}`,
        JSON.stringify({ grid: Array.from({ length: size }, () => Array.from({ length: size }, () => 0)), complete: false }),
      );
    } catch {}
    clearCelebration();
    if (userIsLoggedIn) {
      (async () => {
        try {
          const body: Record<string, unknown> = { date: dateStr };
          if (difficulty === 'easy') body.easy = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
          if (difficulty === 'medium') body.medium = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
          if (difficulty === 'hard') body.hard = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
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
    if (!cleared) return;
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
            window.localStorage.setItem(`picross:seconds:${dateStr}:${difficulty}`, String(elapsedSec));
            window.localStorage.setItem(`picross:progress:${dateStr}:${difficulty}`, JSON.stringify({ grid, complete: true, seconds: elapsedSec }));
          } catch (err) { console.debug('picross:final local save err', err); }
        } else {
          try {
            window.localStorage.setItem(`picross:seconds:${dateStr}:${difficulty}`, String(elapsedSec));
            try {
              const bestKey = `picross:fastest:${difficulty}`;
              const existing = Number(window.localStorage.getItem(bestKey) || 0) || 0;
              if (!existing || elapsedSec < existing) window.localStorage.setItem(bestKey, String(elapsedSec));
            } catch {}
            try {
              window.localStorage.setItem(`picross:progress:${dateStr}:${difficulty}`, JSON.stringify({ grid, complete: true, seconds: elapsedSec }));
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
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(`picross:progress:${dateStr}:${difficulty}`, JSON.stringify({ grid, complete: cleared }));
      } catch (err) { console.debug('localStorage write error', err); }
    }, 400) as unknown as number;
    return () => { if (debounceTimeout.current) clearTimeout(debounceTimeout.current); };
  }, [grid, cleared, difficulty, editorMode, dateStr]);

  return (
    <div className="nonogram-root" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', marginTop: 0, background: '#cca3ff', width: '100%', overflow: 'hidden', paddingTop: 15, colorScheme: 'light' }}>
      <div style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 15, paddingRight: 15, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={async () => {
              try { await saveSecondsNow(); } catch (err) { console.debug('picross:save on back err', err); }
              router.push('/nonogram?replay=1');
            }}
            aria-label="Back"
            style={{ color: '#000', background: 'transparent', border: 'none', padding: '0px 0px', margin: 0, fontSize: 36, lineHeight: 1, cursor: 'pointer', fontWeight: 800, position: 'relative',  left: '7px' }}
          >
            ‹
          </button>
          <h2 style={{ color: '#000', margin: 5, paddingLeft: 20, fontFamily: DEFAULT_FONT, fontWeight: '500', fontSize: 25 }}>{formattedDate}</h2>
        </div>
      </div>

      <GridBoard
        size={size}
        leftWidth={leftWidth}
        topHeight={topHeight}
        cellPx={cellPx}
        CLUE_FONT_PX={CLUE_FONT_PX}
        clueGap={clueGap}
        puzzle={puzzle}
        grid={grid}
        rowClues={rowClues}
        colClues={colClues}
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
        pointerActiveRef={pointerActiveRef}
        pointerActionRef={pointerActionRef}
        applyActionToCell={applyActionToCell}
        inputMode={inputMode}
        setSaveDate={setSaveDate}
        getRunsForCol={getRunsForCol}
        getRunsMetaForCol={getRunsMetaForCol}
        getRunsForRow={getRunsForRow}
        getRunsMetaForRow={getRunsMetaForRow}
        isFilledCell={isFilledCell}
        isXCell={isXCell}
        celebrateGrid={celebrateGrid}
        fontFamily={fontFamily}
        fontWeight={fontWeight}
        firstStart={!startAnimationDone}
        onStartComplete={() => {
          try { window.localStorage.setItem(`picross:startShown:${dateStr}:${difficulty}`, '1'); } catch {}
          setStartAnimationDone(true);
        }}
        showTimer={(typeof window === 'undefined') ? true : (getPicrossSettings().showTimer !== false)}
      />

      {cleared && !editorMode ? (
        <div style={{ marginTop: 4, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          <div ref={completeTextRef} style={{ background: 'transparent', color: '#5a2b8a', fontWeight: 800, padding: '12px 16px', borderRadius: 8, wordBreak: 'keep-all', textShadow: '0 2px 6px rgba(0,0,0,0.08)', transformOrigin: 'center', opacity: statsSettled && fillAnimDone ? undefined : 0 }}>
            {completeMessage}
          </div>
          <button
            onClick={handleShare}
            style={{ fontFamily: DEFAULT_FONT, fontWeight: 700, fontSize: 15, padding: '8px 22px', borderRadius: 8, border: '2px solid #5a2b8a', background: copied ? '#5a2b8a' : '#fff', color: copied ? '#fff' : '#5a2b8a', cursor: 'pointer', transition: 'background 0.2s, color 0.2s', letterSpacing: 0.5 }}
          >
            {copied ? '✓ Copied!' : '📋 Share'}
          </button>
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

export default function PicrossPage() {
  return (
    <React.Suspense fallback={<div>Loading Nonogram...</div>}>
      <PicrossPlayInner />
    </React.Suspense>
  );
}
