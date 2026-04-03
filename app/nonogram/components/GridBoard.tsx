"use client";
import React from "react";
import TimerWithPB from './TimerWithPB';
import ClueColumn from './ClueColumn';
import ClueRow from './ClueRow';
import GridCell from './GridCell';
import { computeFulfilledArray } from '../runUtils';
import { getMSTDateString } from '../time';

// Divider color used for 5x/10x block separators — change here to update UI
const DIVIDER_COLOR = 'rgb(57, 255, 8)';

export default function GridBoard(props: any) {
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
    setShowNewPB,
    pointerActiveRef,
    pointerActionRef,
    applyActionToCell,
    inputMode,
    setSaveDate,
    saveDate,
    handleSave,
    handleNextDate,
    handlePrevDate,
    handleClearEditor,
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

  const showTimer = typeof props.showTimer === 'undefined' ? true : !!props.showTimer;

  const getDefaultPuzzle = (size: number) => Array(size).fill(0).map(() => Array(size).fill(false));

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

  return (
    <div onPointerMove={ (e: any) => {
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
          setEditorPuzzle((prev: any) => {
            const base = prev ?? ((prefetchPuzzle && prefetchPuzzle[difficulty]) ?? getDefaultPuzzle(size));
            const next = base.map((row: any) => [...row]);
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
                            const hasCells = Array.isArray(entry) && entry.some((row: any) => Array.isArray(row) && row.some(Boolean));
                            // If the fetched puzzle has any filled cells, skip — keep searching
                            if (hasCells) {
                              // continue searching to find the next blank date
                            } else {
                              // no puzzle content for this date; make it the target
                              setEditorPuzzle(getDefaultPuzzle(size));
                              setSaveDate(ds);
                              findNextAbort.current = null;
                              return;
                            }
                          }
                      }
                      setSaveDate(getMSTDateString(today));
                    } catch (err) { const maybe = err as { name?: string } | undefined; if (maybe && maybe.name === 'AbortError') return; console.debug('findNextFreeDate error', err); } finally { findNextAbort.current = null; }
                  })();
                } else { setEditorPuzzle(null); setSaveDate(''); if (findNextAbort.current) { try { findNextAbort.current.abort(); } catch {} } }
              }} />
              Editor
            </label>
          )}
          <div style={{ display: showTimer ? 'block' : 'none' }}>
            <TimerWithPB elapsedSec={elapsedSec} cleared={cleared} showNewPB={showNewPB} firstStart={firstStart} onStartComplete={onStartComplete} />
          </div>
        </div>
        {Array.from({ length: size }).map((_, i) => i).map(i => {
          const runs = getRunsForCol(i);
          const meta = getRunsMetaForCol(i);
          const clueForIndex = editorMode ? (displayColClues[i] || []) : ((colClues && colClues[i]) || []);
          const fulfilled = computeFulfilledArray(clueForIndex, runs, meta, size, (r: number, c: number) => isFilledCell(r,c), (r:number,c:number)=> isXCell(r,c), false, i);
          return <ClueColumn key={i} clue={clueForIndex} fulfilled={fulfilled} cellPx={cellPx} topHeight={topHeight} fontSize={CLUE_FONT_PX} index={i} firstStart={firstStart} />;
        })}
      </div>
      {displayGrid.map((row: any, r: number) => {
        const runs = getRunsForRow(r);
        const meta = getRunsMetaForRow(r);
        const clueForRow = editorMode ? (displayRowClues[r] || []) : ((rowClues && rowClues[r]) || []);
        const fulfilled = computeFulfilledArray(clueForRow, runs, meta, size, (rr:number,cc:number)=> isFilledCell(rr,cc), (rr:number,cc:number)=> isXCell(rr,cc), true, r);
        return (
          <div key={r} style={{ display: 'flex' }}>
            <div style={{ width: leftWidth, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: CLUE_FONT_PX, paddingRight: 12, background: (r % 2 === 0) ? '#e8e8e8' : '#ffffff' }}>
              <ClueRow clue={clueForRow} fulfilled={fulfilled} clueGap={clueGap} fontSize={CLUE_FONT_PX} firstStart={firstStart} />
            </div>
            {row.map((cell: any, c: number) => {
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
                  const val = cell as any;
                  if (val === 1) return '#222';
                  if (val === 2) return '#f0f0f0';
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
                      setEditorPuzzle((prev: any) => {
                        const base = prev ?? ((prefetchPuzzle && prefetchPuzzle[difficulty]) ?? getDefaultPuzzle(size));
                        const next = base.map((row: any) => [...row]);
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
                        setPrefetch((prev: any) => {
                          const cur = (prev.progress && prev.progress[difficulty]) ?? Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
                          const next: any = cur.map((row: any) => row.map((v: any) => (Math.max(0, Math.min(3, Math.trunc(Number(v || 0)))))));
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
                        setEditorPuzzle((prev: any) => {
                          const base = prev ?? ((prefetchPuzzle && prefetchPuzzle[difficulty]) ?? getDefaultPuzzle(size));
                          const next = base.map((row: any) => [...row]);
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
