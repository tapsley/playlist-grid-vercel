"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import type { CellState } from '../PicrossPrefetchContext';

interface UseTimerOptions {
  dateStr: string;
  difficulty: string;
  userIsLoggedIn: boolean;
  startAnimationDone: boolean;
  cleared: boolean;
  editorMode: boolean;
  grid: CellState[][];
  disableSave?: boolean;
  disableTimer?: boolean;
}

export function useTimer({
  dateStr,
  difficulty,
  userIsLoggedIn,
  startAnimationDone,
  cleared,
  editorMode,
  grid,
  disableSave = false,
  disableTimer = false,
}: UseTimerOptions) {
  const timerRef = useRef<number | null>(null);
  const saveTimerDebounce = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const disableSaveRef = useRef(disableSave);
  useEffect(() => { disableSaveRef.current = disableSave; }, [disableSave]);

  const [elapsedSec, setElapsedSec] = useState<number>(() => {
    try {
      const key = `picross:seconds:${dateStr}:${difficulty}`;
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      return userIsLoggedIn ? 0 : (raw ? (Number(raw) || 0) : 0);
    } catch { return 0; }
  });

  // Keep refs current so stable callbacks always read fresh values
  const elapsedSecRef = useRef(elapsedSec);
  const gridRef = useRef(grid);
  const clearedRef = useRef(cleared);
  const userIsLoggedInRef = useRef(userIsLoggedIn);
  useEffect(() => { elapsedSecRef.current = elapsedSec; }, [elapsedSec]);
  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { clearedRef.current = cleared; }, [cleared]);
  useEffect(() => { userIsLoggedInRef.current = userIsLoggedIn; }, [userIsLoggedIn]);

  // Start timer when animation done, puzzle not cleared, not in editor, not in editor-test mode
  useEffect(() => {
    if (editorMode || disableTimer || cleared || !startAnimationDone) return;
    if (timerRef.current) return;
    timerRef.current = window.setInterval(() => {
      dirtyRef.current = true;
      setElapsedSec(s => s + 1);
    }, 1000) as unknown as number;
    return () => {
      if (timerRef.current) { window.clearInterval(timerRef.current as unknown as number); timerRef.current = null; }
    };
  }, [editorMode, disableTimer, cleared, startAnimationDone]);

  // Stop timer when puzzle is cleared
  useEffect(() => {
    if (!cleared) return;
    if (timerRef.current) { window.clearInterval(timerRef.current as unknown as number); timerRef.current = null; }
  }, [cleared]);

  // Periodic local save (5s debounce, reads refs so values are fresh at fire time)
  useEffect(() => {
    if (disableSave) return;
    if (saveTimerDebounce.current) clearTimeout(saveTimerDebounce.current);
    saveTimerDebounce.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(`picross:seconds:${dateStr}:${difficulty}`, String(elapsedSecRef.current));
        window.localStorage.setItem(
          `picross:progress:${dateStr}:${difficulty}`,
          JSON.stringify({ grid: gridRef.current, complete: clearedRef.current, seconds: elapsedSecRef.current }),
        );
      } catch (err) { console.debug('picross:periodic local save err', err); }
    }, 5000) as unknown as number;
    return () => { if (saveTimerDebounce.current) clearTimeout(saveTimerDebounce.current); };
  }, [elapsedSec, difficulty, dateStr, userIsLoggedIn, disableSave]);

  // Sync seconds from server when logged in
  useEffect(() => {
    if (!userIsLoggedIn) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/picross/progress?date=${dateStr}`);
        if (!res.ok || !mounted) return;
        const json = await res.json();
        let sec = 0;
        if (difficulty === 'easy') sec = Number(json?.easySeconds || 0) || 0;
        if (difficulty === 'medium') sec = Number(json?.mediumSeconds || 0) || 0;
        if (difficulty === 'hard') sec = Number(json?.hardSeconds || 0) || 0;
        setElapsedSec(sec || 0);
      } catch (err) { console.debug('fetch server seconds failed', err); }
    })();
    return () => { mounted = false; };
  }, [userIsLoggedIn, dateStr, difficulty]);

  // Mark dirty on grid change so auto-save picks it up
  useEffect(() => {
    if (!cleared) dirtyRef.current = true;
  }, [grid]);

  // Stable save function — reads refs so it is safe to call from any handler
  const saveSecondsNow = useCallback(async () => {
    if (disableSaveRef.current) return;
    const currentElapsed = elapsedSecRef.current;
    const currentGrid = gridRef.current;
    const currentCleared = clearedRef.current;
    const isLoggedIn = userIsLoggedInRef.current;
    try {
      if (isLoggedIn) {
        const body: Record<string, unknown> = { date: dateStr };
        if (difficulty === 'easy') { body.easySeconds = currentElapsed; body.easy = currentGrid; }
        if (difficulty === 'medium') { body.mediumSeconds = currentElapsed; body.medium = currentGrid; }
        if (difficulty === 'hard') { body.hardSeconds = currentElapsed; body.hard = currentGrid; }
        try {
          await fetch('/api/picross/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        } catch (err) { console.debug('picross:saveSecondsNow server POST failed', err); }
        try {
          window.localStorage.setItem(`picross:seconds:${dateStr}:${difficulty}`, String(currentElapsed));
          window.localStorage.setItem(
            `picross:progress:${dateStr}:${difficulty}`,
            JSON.stringify({ grid: currentGrid, complete: currentCleared, seconds: currentElapsed }),
          );
        } catch (err) { console.debug('picross:saveSecondsNow local save err', err); }
      } else {
        try {
          window.localStorage.setItem(`picross:seconds:${dateStr}:${difficulty}`, String(currentElapsed));
          try {
            const pKey = `picross:progress:${dateStr}:${difficulty}`;
            const existing = window.localStorage.getItem(pKey);
            const payload: Record<string, unknown> = { grid: currentGrid, complete: currentCleared, seconds: currentElapsed };
            if (existing) {
              try { const parsed = JSON.parse(existing) as Record<string, unknown>; if (parsed?.grid) payload.grid = parsed.grid; } catch {}
            }
            window.localStorage.setItem(pKey, JSON.stringify(payload));
          } catch (err) { console.debug('picross:save progress payload err', err); }
        } catch (err) { console.debug('picross:save seconds now err', err); }
      }
    } catch (err) { console.debug('save seconds now err', err); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- reads from refs; dateStr/difficulty are frozen URL params

  // Auto-save on tab hide and every 60 seconds
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && dirtyRef.current) {
        dirtyRef.current = false;
        saveSecondsNow();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    const interval = window.setInterval(() => {
      if (dirtyRef.current && !clearedRef.current) {
        dirtyRef.current = false;
        saveSecondsNow();
      }
    }, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- saveSecondsNow is stable; clearedRef always current

  return { elapsedSec, setElapsedSec, saveSecondsNow };
}
