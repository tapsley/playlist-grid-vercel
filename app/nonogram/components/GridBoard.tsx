"use client";
import React, { useMemo } from "react";
import TimerWithPB from './TimerWithPB';
import ClueColumn from './ClueColumn';
import ClueRow from './ClueRow';
import GridCell from './GridCell';
import { computeFulfilledArray, computeClues, createEmptyGrid, clampCellState } from '../runUtils';
import type { RunMeta } from '../runUtils';
import { CellState, type PrefetchState, type PrefetchShape } from '../PicrossPrefetchContext';
import type { CellAction } from '../hooks/usePointerDrag';

// Divider color used for 5x/10x block separators — change here to update UI
const DIVIDER_COLOR = 'rgb(57, 255, 8)';

function getCellStyle(
  cellPx: number, r: number, c: number, size: number,
  cell: CellState, celebrateGrid: boolean[][] | null, editorMode: boolean
): React.CSSProperties {
  return {
    width: cellPx, height: cellPx, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderStyle: 'solid', borderWidth: 1, borderColor: '#888',
    borderRightColor: ((size >= 10 && c === 4) || (size === 15 && c === 9)) ? DIVIDER_COLOR : '#888',
    borderLeftColor:  ((size >= 10 && c === 5) || (size === 15 && c === 10)) ? DIVIDER_COLOR : '#888',
    borderBottomColor: ((size >= 10 && r === 4) || (size === 15 && r === 9)) ? DIVIDER_COLOR : '#888',
    borderTopColor:   ((size >= 10 && r === 5) || (size === 15 && r === 10)) ? DIVIDER_COLOR : '#888',
    background: (() => {
      if (celebrateGrid && celebrateGrid[r] && celebrateGrid[r][c]) return '#d4af37';
      if (editorMode) return (cell ? '#222' : '#fff');
      if (cell === CellState.FILLED) return '#222';
      if (cell === CellState.MAYBE) return '#f0f0f0';
      return '#fff';
    })(),
    cursor: 'pointer', fontSize: Math.max(12, Math.round(cellPx * 0.65)), userSelect: 'none', touchAction: 'none', position: 'relative',
  };
}

export interface GridBoardLayout {
  size: number;
  leftWidth: number;
  topHeight: number;
  cellPx: number;
  CLUE_FONT_PX: number;
  clueGap: number;
  fontFamily: string;
  fontWeight: number;
}

export interface GridBoardEditorProps {
  editorMode: boolean;
  activateEditorMode: () => void;
  deactivateEditorMode: () => void;
  editorPuzzle: boolean[][] | null;
  setEditorPuzzle: React.Dispatch<React.SetStateAction<boolean[][] | null>>;
  isEditorAllowed: boolean;
}

export interface GridBoardPrefetch {
  prefetchPuzzle: Record<string, boolean[][]> | null;
  prefetchProgress: Record<string, CellState[][]> | null;
  setPrefetch: PrefetchShape['setPrefetch'];
  difficulty: string;
}

export interface GridBoardPointer {
  pointerActiveRef: React.MutableRefObject<boolean>;
  pointerActionRef: React.MutableRefObject<CellAction | null>;
  applyActionToCell: (r: number, c: number, action: CellAction) => void;
  inputMode: 'fill' | 'maybe' | 'x';
}

export interface GridBoardClues {
  rowClues: number[][];
  colClues: number[][];
  getRunsForCol: (c: number) => number[];
  getRunsMetaForCol: (c: number) => RunMeta[];
  getRunsForRow: (r: number) => number[];
  getRunsMetaForRow: (r: number) => RunMeta[];
  isFilledCell: (r: number, c: number) => boolean;
  isXCell: (r: number, c: number) => boolean;
}

export interface GridBoardProps {
  layout: GridBoardLayout;
  editor: GridBoardEditorProps;
  prefetch: GridBoardPrefetch;
  pointer: GridBoardPointer;
  clues: GridBoardClues;
  puzzle: boolean[][];
  grid: CellState[][];
  elapsedSec: number;
  cleared: boolean;
  showNewPB: boolean;
  celebrateGrid: boolean[][] | null;
  firstStart: boolean;
  onStartComplete: () => void;
  setSaveDate: React.Dispatch<React.SetStateAction<string>>;
  showTimer?: boolean;
}

export default function GridBoard(props: GridBoardProps) {
  const { layout, editor, prefetch, pointer, clues, puzzle, grid, elapsedSec, cleared, showNewPB, celebrateGrid, firstStart, onStartComplete, setSaveDate } = props;
  const { size, leftWidth, topHeight, cellPx, CLUE_FONT_PX, clueGap, fontFamily, fontWeight } = layout;
  const { editorMode, activateEditorMode, deactivateEditorMode, editorPuzzle, setEditorPuzzle, isEditorAllowed } = editor;
  const { prefetchPuzzle, prefetchProgress, setPrefetch, difficulty } = prefetch;
  const { pointerActiveRef, pointerActionRef, applyActionToCell, inputMode } = pointer;
  const { rowClues, colClues, getRunsForCol, getRunsMetaForCol, getRunsForRow, getRunsMetaForRow, isFilledCell, isXCell } = clues;

  const showTimer = props.showTimer ?? true;

  const basePuzzle = prefetchPuzzle?.[difficulty] ?? createEmptyGrid(size, false);
  /** Build a mutable copy of the editor puzzle, falling back to prefetch → empty grid. */
  const editorPuzzleBase = (prev: boolean[][] | null) =>
    (prev ?? basePuzzle).map(row => [...row]);

  // derive display puzzle/grid and computed clues for editor vs play mode
  const displayPuzzleForClues = editorMode ? (editorPuzzle ?? basePuzzle) : (puzzle ?? createEmptyGrid(size, false));
  const { rows: displayRowClues, cols: displayColClues } = computeClues(displayPuzzleForClues);
  const displayGrid = editorMode ? (editorPuzzle ?? basePuzzle) : grid;

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

  const handleEditorPointerDown = (r: number, c: number) => {
    const cur = (editorPuzzle && editorPuzzle[r] && typeof editorPuzzle[r][c] !== 'undefined')
      ? !!editorPuzzle[r][c]
      : !!(prefetchPuzzle && prefetchPuzzle[difficulty] && prefetchPuzzle[difficulty][r] && prefetchPuzzle[difficulty][r][c]);
    const newVal = !cur;
    setEditorPuzzle(prev => {
      const next = editorPuzzleBase(prev);
      next[r][c] = newVal;
      return next;
    });
    pointerActionRef.current = newVal ? 'fill' : 'erase';
  };

  const handlePlayPointerDown = (r: number, c: number, e: React.PointerEvent) => {
    const val = (prefetchProgress && prefetchProgress[difficulty] && prefetchProgress[difficulty][r] && prefetchProgress[difficulty][r][c]) ?? CellState.EMPTY;
    if (e.button === 2) {
      if (val === CellState.FILLED || val === CellState.X) {
        pointerActionRef.current = 'erase';
        applyActionToCell(r, c, 'erase');
      } else {
        pointerActionRef.current = 'fillX';
        applyActionToCell(r, c, 'fillX');
      }
      return;
    }
    if (inputMode === 'fill') {
      if (val === CellState.FILLED) {
        pointerActionRef.current = 'erase';
        applyActionToCell(r, c, 'erase');
      } else if (val === CellState.X) {
        setPrefetch(prev => {
          const cur: CellState[][] = (prev.progress?.[difficulty]) ?? createEmptyGrid(size, CellState.EMPTY);
          const next: CellState[][] = cur.map(row => row.map(v => clampCellState(v)));
          next[r][c] = CellState.EMPTY;
          return { ...prev, progress: { ...prev.progress, [difficulty]: next } } as PrefetchState;
        });
        pointerActionRef.current = 'fill';
      } else {
        pointerActionRef.current = 'fill';
        applyActionToCell(r, c, 'fill');
      }
    } else if (inputMode === 'x') {
      if (val === CellState.FILLED || val === CellState.X) {
        pointerActionRef.current = 'erase';
        applyActionToCell(r, c, 'erase');
      } else {
        pointerActionRef.current = 'fillX';
        applyActionToCell(r, c, 'fillX');
      }
    } else {
      pointerActionRef.current = (val === CellState.MAYBE ? 'eraseMaybe' : 'fillMaybe');
      applyActionToCell(r, c, pointerActionRef.current);
    }
  };

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
            const next = editorPuzzleBase(prev);
            if (next[rr][cc] === doFill) return prev;
            next[rr][cc] = doFill;
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
                if (e.target.checked) activateEditorMode(); else deactivateEditorMode();
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
      {(displayGrid as CellState[][]).map((row: CellState[], r: number) => {
        const clueForRow = editorMode ? (displayRowClues[r] || []) : ((rowClues && rowClues[r]) || []);
        return (
          <div key={r} style={{ display: 'flex' }}>
            <div style={{ width: leftWidth, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: CLUE_FONT_PX, paddingRight: 12, background: (r % 2 === 0) ? '#e8e8e8' : '#ffffff' }}>
            <ClueRow clue={clueForRow} fulfilled={fulfilledRows[r]} clueGap={clueGap} fontSize={CLUE_FONT_PX} firstStart={firstStart} />
            </div>
            {row.map((cell: CellState, c: number) => {
              const cellStyle = getCellStyle(cellPx, r, c, size, cell, celebrateGrid, editorMode);

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
                    if (editorMode) handleEditorPointerDown(r, c);
                    else handlePlayPointerDown(r, c, e);
                  }}
                  onPointerEnter={() => {
                    if (cleared && !editorMode) return;
                    if (!pointerActiveRef.current || !pointerActionRef.current) return;
                    if (editorMode) {
                      if (pointerActionRef.current === 'fill' || pointerActionRef.current === 'erase') {
                        const doFill = pointerActionRef.current === 'fill';
                        setEditorPuzzle(prev => {
                          const next = editorPuzzleBase(prev);
                          if (next[r][c] === doFill) return prev;
                          next[r][c] = doFill;
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
