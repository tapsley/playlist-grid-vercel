"use client";
import { useRef, useEffect } from 'react';
import type { CellState, PrefetchState, PrefetchShape } from '../PicrossPrefetchContext';

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
      const cur: CellState[][] = (prev.progress?.[difficulty]) ?? Array.from({ length: size }, () => Array.from({ length: size }, () => 0 as CellState));
      const next: CellState[][] = cur.map((row: CellState[]) =>
        row.map(v => Math.max(0, Math.min(3, Math.trunc(Number(v) || 0))) as CellState)
      );
      const currentVal = next[r][c] as number;
      if (action === "fill") {
        if (currentVal === 1 || currentVal === 3) return prev;
        next[r][c] = 1;
      } else if (action === "erase") {
        if (currentVal === 0) return prev;
        next[r][c] = 0;
      } else if (action === "fillX") {
        if (currentVal === 1 || currentVal === 3) return prev;
        next[r][c] = 3;
      } else if (action === "fillMaybe") {
        if (currentVal === 1 || currentVal === 3 || currentVal === 2) return prev;
        next[r][c] = 2;
      } else if (action === "eraseMaybe") {
        if (currentVal !== 2) return prev;
        next[r][c] = 0;
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
