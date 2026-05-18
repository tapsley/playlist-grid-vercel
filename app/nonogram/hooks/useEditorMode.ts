"use client";
import { useState, useEffect, useRef } from 'react';
import type { PrefetchState, PrefetchShape } from '../PicrossPrefetchContext';
import { getMSTDateString } from '../time';
import { createEmptyGrid } from '../runUtils';

function getDefaultPuzzle(size: number): boolean[][] {
  return createEmptyGrid(size, false);
}

function isPuzzleEmpty(entry: unknown): boolean {
  try {
    if (!entry || !Array.isArray(entry) || entry.length === 0) return true;
    for (const row of entry) {
      if (Array.isArray(row)) {
        for (const cell of row) if (cell) return false;
      }
    }
    return true;
  } catch { return true; }
}

interface UseEditorModeOptions {
  isEditorAllowed: boolean;
  size: number;
  difficulty: string;
  prefetchPuzzle: Record<string, boolean[][]> | null;
  setPrefetch: PrefetchShape['setPrefetch'];
}

export function useEditorMode({
  isEditorAllowed,
  size,
  difficulty,
  prefetchPuzzle,
  setPrefetch,
}: UseEditorModeOptions) {
  const [editorMode, setEditorMode] = useState(false);
  const [editorPuzzle, setEditorPuzzle] = useState<boolean[][] | null>(null);
  const [saveDate, setSaveDate] = useState('');
  const findNextAbort = useRef<AbortController | null>(null);

  // Reset editor state when user loses editor access
  useEffect(() => {
    if (!isEditorAllowed) {
      setEditorMode(false);
      setEditorPuzzle(null);
      setSaveDate('');
      if (findNextAbort.current) { try { findNextAbort.current.abort(); } catch {} }
    }
  }, [isEditorAllowed]);

  const handleSave = () => {
    if (!saveDate || !editorPuzzle) return;
    (async () => {
      try {
        const res = await fetch('/api/picross/puzzle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: saveDate, difficulty, puzzle: editorPuzzle }),
        });
        if (res.ok || res.status === 201 || res.status === 204) {
          setPrefetch(prev => ({
            ...prev,
            puzzle: { ...prev.puzzle, [difficulty]: editorPuzzle },
          } as PrefetchState));
          alert(`Saved puzzle for ${saveDate} (${difficulty})`);
        } else {
          const text = await res.text();
          alert(`Save failed: ${res.status} ${text}`);
        }
      } catch (err) {
        console.error(err);
        alert('Save error');
      }
    })();
  };

  const loadDatePuzzle = async (ds: string) => {
    try {
      const res = await fetch(`/api/picross/puzzle?date=${ds}`);
      if (res.status === 404) return getDefaultPuzzle(size);
      if (res.ok) {
        const json = await res.json();
        const entry = json?.[difficulty];
        return isPuzzleEmpty(entry) ? getDefaultPuzzle(size) : (Array.isArray(entry) ? (entry as boolean[][]) : getDefaultPuzzle(size));
      }
    } catch {}
    return getDefaultPuzzle(size);
  };

  const handleNextDate = async () => {
    const base = saveDate || new Date().toISOString().slice(0, 10);
    const d = new Date(base);
    d.setDate(d.getDate() + 1);
    const ds = d.toISOString().slice(0, 10);
    setEditorPuzzle(await loadDatePuzzle(ds));
    setSaveDate(ds);
  };

  const handlePrevDate = async () => {
    const base = saveDate || new Date().toISOString().slice(0, 10);
    const d = new Date(base);
    d.setDate(d.getDate() - 1);
    const ds = d.toISOString().slice(0, 10);
    setEditorPuzzle(await loadDatePuzzle(ds));
    setSaveDate(ds);
  };

  const handleClearEditor = () => {
    setEditorPuzzle(getDefaultPuzzle(size));
  };

  // When entering editor mode, find the next unpublished date automatically
  const activateEditorMode = () => {
    setEditorMode(true);
    setEditorPuzzle((prefetchPuzzle?.[difficulty]) ?? getDefaultPuzzle(size));
    (async () => {
      if (findNextAbort.current) { try { findNextAbort.current.abort(); } catch {} }
      const ac = new AbortController();
      findNextAbort.current = ac;
      try {
        const today = new Date();
        for (let i = 0; i < 365; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() + i);
          const ds = getMSTDateString(d);
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
            const hasCells = Array.isArray(entry) && (entry as unknown[]).some((row: unknown) => Array.isArray(row) && (row as unknown[]).some(Boolean));
            if (!hasCells) {
              setEditorPuzzle(getDefaultPuzzle(size));
              setSaveDate(ds);
              findNextAbort.current = null;
              return;
            }
          }
        }
        setSaveDate(getMSTDateString(today));
      } catch (err) {
        const maybe = err as { name?: string } | undefined;
        if (maybe?.name === 'AbortError') return;
        console.debug('findNextFreeDate error', err);
      } finally { findNextAbort.current = null; }
    })();
  };

  const deactivateEditorMode = () => {
    setEditorMode(false);
    setEditorPuzzle(null);
    setSaveDate('');
    if (findNextAbort.current) { try { findNextAbort.current.abort(); } catch {} }
  };

  return {
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
    activateEditorMode,
    deactivateEditorMode,
  };
}
