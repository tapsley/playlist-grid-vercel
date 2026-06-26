"use client";
import { useRef, useEffect } from 'react';
import { CellState, type PrefetchState, type PrefetchShape } from '../PicrossPrefetchContext';
import { createEmptyGrid, clampCellState } from '../runUtils';

export type CellAction = "fill" | "erase" | "fillX" | "fillMaybe" | "eraseMaybe";

interface UsePointerDragOptions {
  editorMode: boolean;
  startAnimationDone: boolean;
  cleared: boolean;
  isCelebratingRef: React.MutableRefObject<boolean>;
  size: number;
  difficulty: string;
  setPrefetch: PrefetchShape['setPrefetch'];
}

export function usePointerDrag({
  editorMode,
  startAnimationDone,
  cleared,
  isCelebratingRef,
  size,
  difficulty,
  setPrefetch,
}: UsePointerDragOptions) {
  const pointerActiveRef = useRef(false);
  const pointerActionRef = useRef<CellAction | null>(null);

  useEffect(() => {
    const onPointerUp = () => {
      pointerActiveRef.current = false;
      pointerActionRef.current = null;
    };
    window.addEventListener("pointerup", onPointerUp);
    return () => window.removeEventListener("pointerup", onPointerUp);
  }, []);

  const applyActionToCell = (r: number, c: number, action: CellAction) => {
    if (editorMode) return;
    if (!startAnimationDone) return;
    if (isCelebratingRef.current) return;
    if (cleared) return;
    setPrefetch(prev => {
      const rawCur = prev.progress?.[difficulty];
      const cur: CellState[][] = (Array.isArray(rawCur) && rawCur.length > 0) ? rawCur : createEmptyGrid(size, CellState.EMPTY);
      const next: CellState[][] = cur.map((row: CellState[]) =>
        row.map(v => clampCellState(v))
      );
      const currentVal = next[r][c];
      if (action === "fill") {
        if (currentVal === CellState.FILLED || currentVal === CellState.X) return prev;
        next[r][c] = CellState.FILLED;
      } else if (action === "erase") {
        if (currentVal === CellState.EMPTY) return prev;
        next[r][c] = CellState.EMPTY;
      } else if (action === "fillX") {
        if (currentVal === CellState.FILLED || currentVal === CellState.X) return prev;
        next[r][c] = CellState.X;
      } else if (action === "fillMaybe") {
        if (currentVal === CellState.FILLED || currentVal === CellState.X || currentVal === CellState.MAYBE) return prev;
        next[r][c] = CellState.MAYBE;
      } else if (action === "eraseMaybe") {
        if (currentVal !== CellState.MAYBE) return prev;
        next[r][c] = CellState.EMPTY;
      }
      return {
        ...prev,
        progress: {
          ...prev.progress,
          [difficulty]: next,
        },
      } as PrefetchState;
    });
  };

  return { pointerActiveRef, pointerActionRef, applyActionToCell };
}
