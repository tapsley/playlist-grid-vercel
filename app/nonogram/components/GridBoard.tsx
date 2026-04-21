"use client";
import React, { useMemo } from "react";
import TimerWithPB from './TimerWithPB';
import ClueColumn from './ClueColumn';
import ClueRow from './ClueRow';
import GridCell from './GridCell';
import { computeFulfilledArray } from '../runUtils';
import type { RunMeta } from '../runUtils';
import { getMSTDateString } from '../time';
import type { CellState, PrefetchState, PrefetchShape } from '../PicrossPrefetchContext';
import type { CellAction } from '../hooks/usePointerDrag';

// Divider color used for 5x/10x block separators — change here to update UI
const DIVIDER_COLOR = 'rgb(57, 255, 8)';

export interface GridBoardProps {
  size: number;
  leftWidth: number;
  topHeight: number;
  cellPx: number;
  CLUE_FONT_PX: number;
  clueGap: number;
  puzzle: boolean[][];
  grid: CellState[][];
  rowClues: number[][];
  colClues: number[][];
  editorMode: boolean;
  setEditorMode: React.Dispatch<React.SetStateAction<boolean>>;
  editorPuzzle: boolean[][] | null;
  setEditorPuzzle: React.Dispatch<React.SetStateAction<boolean[][] | null>>;
  prefetchPuzzle: Record<string, boolean[][]> | null;
  prefetchProgress: Record<string, CellState[][]> | null;
  setPrefetch: PrefetchShape['setPrefetch'];
  difficulty: string;
  isEditorAllowed: boolean;
  findNextAbort: React.MutableRefObject<AbortController | null>;
  elapsedSec: number;
  cleared: boolean;
  showNewPB: boolean;
  pointerActiveRef: React.MutableRefObject<boolean>;
  pointerActionRef: React.MutableRefObject<CellAction | null>;
  applyActionToCell: (r: number, c: number, action: CellAction) => void;
  inputMode: 'fill' | 'maybe' | 'x';
  setSaveDate: React.Dispatch<React.SetStateAction<string>>;
  getRunsForCol: (c: number) => number[];
  getRunsMetaForCol: (c: number) => RunMeta[];
  getRunsForRow: (r: number) => number[];
  getRunsMetaForRow: (r: number) => RunMeta[];
  isFilledCell: (r: number, c: number) => boolean;
  isXCell: (r: number, c: number) => boolean;
  celebrateGrid: boolean[][] | null;
  fontFamily: string;
  fontWeight: number;
  firstStart: boolean;
  onStartComplete: () => void;
  showTimer?: boolean;
}

export default function GridBoard(props: GridBoardProps) {
  const {
    size,
    leftWidth,
    topHeight,
    cellPx,
    CLUE_FONT_PX,
    clueGap,
    puzzle,
    grid,
    rowClues,
    colClues,
    editorMode,
    setEditorMode,
    editorPuzzle,
    setEditorPuzzle,
    prefetchPuzzle,
    prefetchProgress,
    setPrefetch,
    difficulty,
    isEditorAllowed,
    findNextAbort,
    elapsedSec,
    cleared,
    showNewPB,
    pointerActiveRef,
    pointerActionRef,
    applyActionToCell,
    inputMode,
    setSaveDate,
    getRunsForCol,
    getRunsMetaForCol,
    getRunsForRow,
    getRunsMetaForRow,
    isFilledCell,
    isXCell,
    celebrateGrid,
    fontFamily,
    fontWeight,
    firstStart,
    onStartComplete,
  } = props;

  const showTimer = props.showTimer ?? true;

  const getDefaultPuzzle = (sz: number) => Array(sz).fill(0).map(() => Array(sz).fill(false));

  const computeClues = (puzzle: boolean[][]) => {
    if (!puzzle || puzzle.length === 0) return { rows: [], cols: [] };
    const rows = puzzle.map(row => {
      const clues: number[] = [];
      let count = 0;
      for (const cell of row) {
        if (cell) count++; else if (count) { clues.push(count); count = 0; }
      }
      if (count) clues.push(count);
      return clues.length ? clues : [0];
    });
    const cols: number[][] = [];
    for (let c = 0; c < puzzle[0].length; c++) {
      const clues: number[] = [];
      let count = 0;
      for (let r = 0; r < puzzle.length; r++) {
        if (puzzle[r][c]) count++; else if (count) { clues.push(count); count = 0; }
      }
      if (count) clues.push(count);
      cols.push(clues.length ? clues : [0]);
    }
    return { rows, cols };
  };
  // derive display puzzle/grid and computed clues for editor vs play mode
  const displayPuzzleForClues = editorMode ? (editorPuzzle ?? ((prefetchPuzzle && prefetchPuzzle[difficulty]) ?? getDefaultPuzzle(size))) : (puzzle ?? getDefaultPuzzle(size));
  const { rows: displayRowClues, cols: displayColClues } = computeClues(displayPuzzleForClues);
  const displayGrid = editorMode ? (editorPuzzle ?? ((prefetchPuzzle && prefetchPuzzle[difficulty]) ?? getDefaultPuzzle(size))) : grid;

  // Memoize fulfilled arrays — only recompute when the display grid changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fulfilledCols = useMemo(() => Array.from({ length: size }, (_, i) => {
    const clue = editorMode ? (displayColClues[i] || []) : (colClues?.[i] || []);
    return computeFulfilledArray(clue, getRunsForCol(i), getRunsMetaForCol(i), size, isFilledCell, isXCell, false, i);
  }), [displayGrid, displayColClues, colClues, size, editorMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fulfilledRows = useMemo(() => Array.from({ length: size }, (_, r) => {
    const clue = editorMode ? (displayRowClues[r] || []) : (rowClues?.[r] || []);
    return computeFulfilledArray(clue, getRunsForRow(r), getRunsMetaForRow(r), size, isFilledCell, isXCell, true, r);
  }), [displayGrid, displayRowClues, rowClues, size, editorMode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div onPointerMove={(e: React.PointerEvent) => {
      if (cleared && !editorMode) return;
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
      <div style={{ display: 'flex' }}>
        <div style={{ width: leftWidth, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 6 }}>
          {isEditorAllowed && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={editorMode} onChange={e => {
                const checked = e.target.checked;
                setEditorMode(checked);
                if (checked) {
                  setEditorPuzzle((prefetchPuzzle && prefetchPuzzle[difficulty]) ?? getDefaultPuzzle(size));
                  (async () => {
                    if (findNextAbort.current) { try { findNextAbort.current.abort(); } catch {} }
                    const ac = new AbortController(); findNextAbort.current = ac;
                    try {
                      const today = new Date();
                      for (let i = 0; i < 365; i++) {
                        const d = new Date(today); d.setDate(today.getDate() + i); const ds = getMSTDateString(d);
                        const res = await fetch(`/api/picross/puzzle?date=${ds}`, { signal: ac.signal });
                          if (res.status === 404) {
                            setEditorPuzzle(getDefaultPuzzle(size));
                            setSaveDate(ds);
                            findNextAbort.current = null;
                            return;
                          }
                          if (res.ok) {
                            const json = await res.json();
                            const entry = json?.[difficulty];
                            const hasCells = Array.isArray(entry) && (entry as unknown[]).some(row => Array.isArray(row) && (row as unknown[]).some(Boolean));
                            if (!hasCells) {
                              setEditorPuzzle(getDefaultPuzzle(size));
                              setSaveDate(ds);
                              findNextAbort.current = null;
                              return;
                            }
                          }
                      }
                      setSaveDate(getMSTDateString(today));
                    } catch (err) { const maybe = err as { name?: string } | undefined; if (maybe?.name === 'AbortError') return; console.debug('findNextFreeDate error', err); } finally { findNextAbort.current = null; }
                  })();
                } else { setEditorPuzzle(null); setSaveDate(''); if (findNextAbort.current) { try { findNextAbort.current.abort(); } catch {} } }
              }} />
              Editor
            </label>
          )}
          <div style={{ color: '#000', display: showTimer ? 'block' : 'none' }}>
            <TimerWithPB elapsedSec={elapsedSec} cleared={cleared} showNewPB={showNewPB} firstStart={firstStart} onStartComplete={onStartComplete} />
          </div>
        </div>
        {Array.from({ length: size }).map((_, i) => {
          const clueForIndex = editorMode ? (displayColClues[i] || []) : ((colClues && colClues[i]) || []);
          return <ClueColumn key={i} clue={clueForIndex} fulfilled={fulfilledCols[i]} cellPx={cellPx} topHeight={topHeight} fontSize={CLUE_FONT_PX} index={i} firstStart={firstStart} />;
        })}
      </div>
      {displayGrid.map((row: CellState[], r: number) => {
        const clueForRow = editorMode ? (displayRowClues[r] || []) : ((rowClues && rowClues[r]) || []);
        return (
          <div key={r} style={{ display: 'flex' }}>
            <div style={{ width: leftWidth, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: CLUE_FONT_PX, paddingRight: 12, background: (r % 2 === 0) ? '#e8e8e8' : '#ffffff' }}>
            <ClueRow clue={clueForRow} fulfilled={fulfilledRows[r]} clueGap={clueGap} fontSize={CLUE_FONT_PX} firstStart={firstStart} />
            </div>
            {row.map((cell: CellState, c: number) => {
              const cellStyle: React.CSSProperties = {
                width: cellPx, height: cellPx, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderStyle: 'solid', borderWidth: 1, borderColor: '#888',
                borderRightWidth: 1,
                borderRightColor: ((size >= 10 && c === 4) || (size === 15 && c === 9)) ? DIVIDER_COLOR : '#888',
                borderLeftWidth: 1,
                borderLeftColor: ((size >= 10 && c === 5) || (size === 15 && c === 10)) ? DIVIDER_COLOR : '#888',
                borderBottomWidth: 1,
                borderBottomColor: ((size >= 10 && r === 4) || (size === 15 && r === 9)) ? DIVIDER_COLOR : '#888',
                borderTopWidth: 1,
                borderTopColor: ((size >= 10 && r === 5) || (size === 15 && r === 10)) ? DIVIDER_COLOR : '#888',
                background: (() => {
                  if (celebrateGrid && celebrateGrid[r] && celebrateGrid[r][c]) return '#d4af37';
                  if (editorMode) return (cell ? '#222' : '#fff');
                  if (cell === 1) return '#222';
                  if (cell === 2) return '#f0f0f0';
                  return '#fff';
                })(),
                cursor: 'pointer', fontSize: Math.max(12, Math.round(cellPx * 0.65)), userSelect: 'none', touchAction: 'none', position: 'relative'
              };

              return (
                <GridCell
                  key={c}
                  r={r}
                  c={c}
                  cell={cell}
                  cellPx={cellPx}
                  celebrateGrid={celebrateGrid}
                  editorMode={editorMode}
                  cellStyle={cellStyle}
                  onPointerDown={(e: React.PointerEvent) => {
                    e.preventDefault();
                    if (cleared && !editorMode) return;
                    pointerActiveRef.current = true;
                    if (editorMode) {
                      const cur = (editorPuzzle && editorPuzzle[r] && typeof editorPuzzle[r][c] !== 'undefined') ? !!editorPuzzle[r][c] : !!(prefetchPuzzle && prefetchPuzzle[difficulty] && prefetchPuzzle[difficulty][r] && prefetchPuzzle[difficulty][r][c]);
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
                    if (e.button === 2) {
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
                        pointerActionRef.current = 'erase';
                        applyActionToCell(r, c, 'erase');
                      } else if (val === 3) {
                        setPrefetch(prev => {
                          const cur: CellState[][] = (prev.progress?.[difficulty]) ?? Array.from({ length: size }, () => Array.from({ length: size }, () => 0 as CellState));
                          const next: CellState[][] = cur.map(row => row.map(v => Math.max(0, Math.min(3, Math.trunc(Number(v) || 0))) as CellState));
                          next[r][c] = 0;
                          return { ...prev, progress: { ...prev.progress, [difficulty]: next } } as PrefetchState;
                        });
                        pointerActionRef.current = 'fill';
                      } else {
                        pointerActionRef.current = 'fill';
                        applyActionToCell(r, c, 'fill');
                      }
                    } else if (inputMode === 'x') {
                      if (val === 1 || val === 3) {
                        pointerActionRef.current = 'erase';
                        applyActionToCell(r, c, 'erase');
                      } else {
                        pointerActionRef.current = 'fillX';
                        applyActionToCell(r, c, 'fillX');
                      }
                    } else {
                      pointerActionRef.current = (val === 2 ? 'eraseMaybe' : 'fillMaybe');
                      applyActionToCell(r, c, pointerActionRef.current);
                    }
                  }}
                  onPointerEnter={() => {
                    if (cleared && !editorMode) return;
                    if (!pointerActiveRef.current || !pointerActionRef.current) return;
                    if (editorMode) {
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
                  onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
