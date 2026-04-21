"use client";
import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import type { CellState, PrefetchState, PrefetchShape } from '../PicrossPrefetchContext';
import pickSequence from '../celebrations/sequenceBank';
import { ADMIN_EMAIL } from '../../../lib/constants';

interface UseCelebrationOptions {
  cleared: boolean;
  elapsedSec: number;
  grid: CellState[][];
  puzzle: boolean[][];
  size: number;
  difficulty: string;
  userIsLoggedIn: boolean;
  isAdmin: boolean;
  setPrefetch: PrefetchShape['setPrefetch'];
}

export function useCelebration({
  cleared,
  elapsedSec,
  grid,
  puzzle,
  size,
  difficulty,
  userIsLoggedIn,
  isAdmin,
  setPrefetch,
}: UseCelebrationOptions) {
  const celebrationTimeouts = useRef<number[]>([]);
  const isCelebratingRef = useRef(false);
  const pbTimeoutRef = useRef<number | null>(null);
  const [celebrateGrid, setCelebrateGrid] = useState<boolean[][] | null>(null);
  const [showNewPB, setShowNewPB] = useState(false);
  const completeTextRef = useRef<HTMLDivElement | null>(null);
  const completeAnimStartedRef = useRef(false);

  // Keep refs current so triggerCelebration always reads fresh values
  const elapsedSecRef = useRef(elapsedSec);
  const gridRef = useRef(grid);
  const puzzleRef = useRef(puzzle);
  const clearedRef = useRef(cleared);
  useEffect(() => { elapsedSecRef.current = elapsedSec; }, [elapsedSec]);
  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { puzzleRef.current = puzzle; }, [puzzle]);
  useEffect(() => { clearedRef.current = cleared; }, [cleared]);

  // Clears all celebration state and stops any in-progress animation
  const clearCelebration = () => {
    setCelebrateGrid(null);
    for (const t of celebrationTimeouts.current) try { window.clearTimeout(t); } catch {}
    celebrationTimeouts.current = [];
    isCelebratingRef.current = false;
  };

  const triggerCelebration = async () => {
    if (!clearedRef.current) return;
    if (isCelebratingRef.current) return;
    isCelebratingRef.current = true;

    // Clear any leftover timers from a previous run (keep isCelebratingRef = true)
    for (const t of celebrationTimeouts.current) try { window.clearTimeout(t); } catch {}
    celebrationTimeouts.current = [];

    const currentGrid = gridRef.current;
    const currentPuzzle = puzzleRef.current;

    // Strip maybe/X marks before the celebration fill animation
    try {
      setPrefetch(prev => {
        const cur: CellState[][] = (prev.progress?.[difficulty]) ?? Array.from({ length: size }, () => Array.from({ length: size }, () => 0 as CellState));
        const next: CellState[][] = cur.map((row: CellState[]) => row.map(v => (v === 2 || v === 3) ? 0 : v));
        return { ...prev, progress: { ...prev.progress, [difficulty]: next } } as PrefetchState;
      });
    } catch (err) { console.debug('clear maybe/x before celebration failed', err); }

    const filled: Array<[number, number]> = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (currentPuzzle[r]?.[c] && currentGrid[r]?.[c] === 1) filled.push([r, c]);
      }
    }

    setCelebrateGrid(Array.from({ length: size }, () => Array.from({ length: size }, () => false)));

    const pick = pickSequence(filled, size);
    if (isAdmin) console.log('picross: celebration sequence ->', pick.name);
    const delay = 60;
    pick.order.forEach(([r, c], i) => {
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

    const total = Math.max(500, filled.length * delay + 200);
    const endT = window.setTimeout(() => { isCelebratingRef.current = false; }, total);
    celebrationTimeouts.current.push(endT as unknown as number);

    // Personal-best detection (runs after animation starts, separate async)
    (async () => {
      const currentElapsed = elapsedSecRef.current;
      try {
        let prior: number | null = null;
        if (userIsLoggedIn) {
          try {
            const res = await fetch('/api/picross/stats');
            if (res.ok) {
              const json = await res.json();
              prior = Number(json?.fastest?.[difficulty] ?? null) || null;
            }
          } catch {}
        } else {
          try {
            const raw = window.localStorage.getItem(`picross:fastest:${difficulty}`);
            if (raw) prior = Number(raw) || null;
          } catch {}
        }
        if (currentElapsed > 0 && (prior === null || currentElapsed < prior)) {
          try { window.localStorage.setItem(`picross:fastest:${difficulty}`, String(currentElapsed)); } catch {}
          setShowNewPB(true);
          if (pbTimeoutRef.current) window.clearTimeout(pbTimeoutRef.current);
          pbTimeoutRef.current = window.setTimeout(() => { setShowNewPB(false); pbTimeoutRef.current = null; }, 8000) as unknown as number;
        }
      } catch (err) { console.debug('picross:detect pb err', err); }
    })();
  };

  // Start/clear celebration when solved state changes
  useEffect(() => {
    if (!cleared) {
      setCelebrateGrid(null);
      for (const t of celebrationTimeouts.current) try { window.clearTimeout(t); } catch {}
      celebrationTimeouts.current = [];
      isCelebratingRef.current = false;
      return;
    }
    if (!isCelebratingRef.current) triggerCelebration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleared]);

  // GSAP letter animation when complete text appears
  useEffect(() => {
    if (!celebrateGrid || !completeTextRef.current) {
      completeAnimStartedRef.current = false;
      return;
    }
    if (completeAnimStartedRef.current) return;
    completeAnimStartedRef.current = true;
    try {
      const el = completeTextRef.current;
      const original = el.textContent || 'Puzzle Complete!';
      const letters: HTMLElement[] = [];
      el.innerHTML = '';
      for (const ch of Array.from(original)) {
        const span = document.createElement('span');
        span.className = 'complete-letter';
        span.style.display = 'inline-block';
        span.style.fontFamily = 'Courier New';
        span.style.transformOrigin = 'center';
        span.textContent = ch === ' ' ? '\u00A0' : ch;
        letters.push(span);
        el.appendChild(span);
      }
      gsap.from(letters, { scale: 0.35, y: 20, opacity: 0, duration: 0.45, ease: 'back.out(1.7)', stagger: 0.05 });
    } catch (err) { console.debug('gsap letter animation failed', err); }
  }, [celebrateGrid]);

  // Clean up PB timeout on unmount
  useEffect(() => {
    return () => {
      if (pbTimeoutRef.current) { try { window.clearTimeout(pbTimeoutRef.current); } catch {} pbTimeoutRef.current = null; }
    };
  }, []);

  return {
    celebrateGrid,
    setCelebrateGrid,
    showNewPB,
    setShowNewPB,
    isCelebratingRef,
    triggerCelebration,
    clearCelebration,
    completeTextRef,
  };
}
