"use client";
import React, { useEffect, useState } from 'react';
import { gsap } from 'gsap';

export default function TimerWithPB({ elapsedSec, cleared, showNewPB, firstStart, onStartComplete }: { elapsedSec: number; cleared: boolean; showNewPB: boolean; firstStart?: boolean; onStartComplete?: () => void }) {
  const formatSec = (s: number) => {
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = Math.floor(s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const [showStart, setShowStart] = useState<boolean>(() => (firstStart ?? false) && elapsedSec === 0);

  useEffect(() => {
    // If elapsedSec becomes non-zero (resumed), only hide START if the
    // START/clue animation is not currently running. This prevents the
    // timer from replacing START mid-animation.
    if (elapsedSec > 0 && !showStart) setShowStart(false);
  }, [elapsedSec, showStart]);

  useEffect(() => {
    // If firstStart changes to false, ensure START is hidden
    if (!firstStart) setShowStart(false);
  }, [firstStart]);

  useEffect(() => {
    if (!showStart) return;
    const TOTAL_MS = 3000;
    let tl: gsap.core.Timeline | null = null;
    try {
      const elems = Array.from(document.querySelectorAll('.clue-number')) as HTMLElement[];
      const N = elems.length;
      if (!N) {
        setShowStart(false);
        return;
      }
      const totalSec = TOTAL_MS / 1000;
      let d = Math.min(0.6, totalSec * 0.25);
      d = Math.max(0.18, d);
      const stagger = N > 1 ? Math.max(0, (totalSec - d) / (N - 1)) : 0;
      tl = gsap.timeline({ onComplete: () => { setShowStart(false); try { onStartComplete && onStartComplete(); } catch {} } });
      tl.fromTo(elems, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: d, ease: 'power2.out', stagger });
    } catch (err) {
      console.debug('gsap clue animation failed', err);
      setShowStart(false);
      try { onStartComplete && onStartComplete(); } catch {}
    }
    const safety = window.setTimeout(() => { setShowStart(false); try { onStartComplete && onStartComplete(); } catch {} }, TOTAL_MS + 300);
    return () => {
      try { if (tl) tl.kill(); } catch {};
      window.clearTimeout(safety);
    };
  }, [showStart]);

  return (
    <>
      <div style={{ fontSize: 29, fontFamily: 'monospace', marginTop: 15, color: cleared ? 'gold' : 'inherit' }}>
        {showStart ? 'START' : formatSec(elapsedSec)}
      </div>
      {showNewPB && (
        <div style={{ marginTop: 8, color: '#1f8f2f', fontWeight: 700, fontSize: 14 }}>
          New personal best!
        </div>
      )}
    </>
  );
}
