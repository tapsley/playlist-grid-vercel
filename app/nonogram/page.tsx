"use client";


import { usePicrossPrefetch } from "./PicrossPrefetchContext";
  

import React, { useState, useEffect, useRef } from "react";
import { gsap } from 'gsap';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from "next-auth/react";
import Link from "next/link";
import DifficultyIcon from "./components/DifficultyIcon";
import dynamic from "next/dynamic";
const UserMenu = dynamic(() => import("../components/UserMenu"), { ssr: false });

const difficulties = [
  { label: "Easy (5x5)", value: "easy", size: 5 },
  { label: "Medium (10x10)", value: "medium", size: 10 },
  { label: "Hard (15x15)", value: "hard", size: 15 },
];

// Placeholder puzzles for each difficulty
const demoPuzzles: Record<string, boolean[][]> = {
  easy: Array(5).fill(0).map(() => Array(5).fill(false)),
  medium: Array(10).fill(0).map(() => Array(10).fill(false)),
  hard: Array(15).fill(0).map(() => Array(15).fill(false)),
};


export default function PicrossSplash() {
  const [difficulty] = useState("easy");
  const { data: session } = useSession();
  const isTyler = !!(session?.user?.email && session.user.email.trim().toLowerCase() === "tyler.apsley@gmail.com");
  const isAuthenticated = !!(session?.user?.email);
  const { progress, puzzle } = usePicrossPrefetch();
  // Ensure progress is always an object and never null
  const safeProgress = (progress && typeof progress === 'object') ? progress : {};
  const typedProgress = safeProgress as Record<string, import("./PicrossPrefetchContext").CellState[][] | undefined>;
  const typedPuzzle = (puzzle || {}) as Record<string, boolean[][] | undefined>;

  const isCompleted = (diff: string) => {
    const prog = typedProgress[diff];
    if (!prog) return false;
    const puz = typedPuzzle[diff];
    if (puz && Array.isArray(puz) && puz.length === prog.length) {
      for (let r = 0; r < puz.length; r++) {
        for (let c = 0; c < (puz[r] || []).length; c++) {
          const should = !!(puz[r] && puz[r][c]);
          const has = prog[r] && typeof prog[r][c] !== 'undefined' ? prog[r][c] === 1 : false;
          if (should !== has) return false;
        }
      }
      return true;
    }
    // fallback: consider complete if every cell in progress is filled (1)
    const allFilled = prog.length > 0 && prog.every(row => Array.isArray(row) && row.every(v => v === 1));
    return allFilled;
  };
  // Prefetching and fetch-on-login are handled by PicrossPrefetchProvider

  const dailyTitleRef = useRef<HTMLHeadingElement | null>(null);
  const dailyAnimStartedRef = useRef(false);
  const dailySubtitleRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const el = dailyTitleRef.current;
    if (!el) return;
    const replay = !!(searchParams && searchParams.get && searchParams.get('replay'));
    if (dailyAnimStartedRef.current && !replay) return;
    dailyAnimStartedRef.current = false; // allow re-run when replay is present
    const original = el.textContent || 'Daily Nonogram';
    // build spans
    const letters: HTMLElement[] = [];
    el.innerHTML = '';
    for (const ch of Array.from(original)) {
      const span = document.createElement('span');
      span.className = 'daily-letter';
      span.style.display = 'inline-block';
      span.style.transformOrigin = 'center';
      span.textContent = ch === ' ' ? '\u00A0' : ch;
      letters.push(span);
      el.appendChild(span);
    }
    try {
      dailyAnimStartedRef.current = true;
      gsap.from(letters, {
        scale: 0.5,
        y: 12,
        opacity: 0,
        duration: 0.45,
        ease: 'back.out(1.6)',
        stagger: 0.04,
      });
      // Animate subtitle after the letters finish
      try {
        const subtitleEl = dailySubtitleRef.current;
        if (subtitleEl) {
          const letterDelay = Math.max(0.2, original.length * 0.04 + 0.05);
          const startDelay = 0.45 + letterDelay; // letters animation + small buffer
          gsap.to(subtitleEl, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', delay: startDelay });
        }
      } catch (err) { console.debug('gsap subtitle animation failed', err); }
    } catch (err) {
      console.debug('gsap daily title animation failed', err);
    }
    // If this was a replay request, clear the query param after animation starts
    if (replay) {
      try {
        setTimeout(() => { try { router.replace('/nonogram'); } catch {} }, 800);
      } catch {}
    }
    return () => {
      try { el.textContent = original; } catch {}
    };
  // re-run when the search params string changes (so ?replay=1 triggers it)
  }, [searchParams?.toString()]);


  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 0, paddingTop: 24, position: "relative", background: '#cca3ff', minHeight: '100vh', width: '100%' }}>
      <div style={{ position: "absolute", top: 16, right: 24, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <UserMenu />
      </div>
      <h1 ref={dailyTitleRef} style={{ fontFamily: "Courier New", fontSize: 36, lineHeight: 1, marginTop: 45, marginBottom: 20, fontWeight: 900, letterSpacing: 3, color: '#111' }}>Daily Nonogram</h1>
      <div ref={dailySubtitleRef} style={{ fontFamily: "Courier New", fontSize: 14, fontWeight: 500,  marginTop: -8, marginBottom: 12, color: '#1f1f1f', opacity: 0, transform: 'translateY(8px)' }}>All puzzles designed by Tyler Apsley</div>
      <div className="difficulty-row">
        {difficulties.map(d => {
          const disabled = (d.value === 'hard' && !isTyler) || (d.value === 'medium' && !isAuthenticated);
          const containerStyle: React.CSSProperties = { border: "3px solid #7c7c7c", borderRadius: 12, background: "#fff", padding: 12, cursor: disabled ? 'default' : 'pointer', display: "inline-block", position: 'relative' };
          return (
            <div key={d.value} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {disabled ? (
                <div className="nonogram-difficulty-btn disabled" style={containerStyle}>
                  <DifficultyIcon grid={typedPuzzle[d.value] ?? demoPuzzles[d.value]} progress={typedProgress[d.value] || undefined} size={140} celebrate={isCompleted(d.value)} />
                  <div style={{ fontFamily: "Courier New", position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.9)', borderRadius: 8, fontWeight: 800, color: '#333' }}>
                    {d.value === 'hard' ? 'Coming soon!' : d.value === 'medium' ? 'Sign in to play!' : 'Locked'}
                  </div>
                </div>
              ) : (
                <Link
                  href={`/nonogram/play?difficulty=${d.value}`}
                  className="nonogram-difficulty-btn"
                  style={containerStyle}
                  prefetch={true}
                >
                  <DifficultyIcon grid={typedPuzzle[d.value] ?? demoPuzzles[d.value]} progress={typedProgress[d.value] || undefined} size={140} celebrate={isCompleted(d.value)} />
                </Link>
              )}
              <div style={{ fontFamily: "Courier New", marginTop: 12, fontWeight: difficulty === d.value ? "bold" : 600, fontSize: 18 }}>{d.label}</div>
            </div>
          );
        })}
      </div>
      <div style={{ width: 'min(1000px, 92%)', background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 8px 30px rgba(0,0,0,0.08)', marginBottom: 48, color: '#111' }}>
        <h2 style={{ fontFamily: "Courier New", fontSize: 22, marginTop: 0, marginBottom: 12, fontWeight: 800 }}>HOW TO PLAY</h2>
        <div style={{ fontFamily: "Courier New", display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 420px', minWidth: 260 }}>
            <p style={{ marginTop: 0, marginBottom: 12, color: '#333' }}>
              Solve the puzzle by filling the correct squares to reveal the hidden picture.
              <br /><br />
              <b>The numbers on the left and top tell you how many filled squares appear in each row and column,
              and in what order.</b> 
              <br/><br/>
              For example, “3 1” means 3 filled squares in a row, then at least one empty square, and then a single filled square. There may be gaps before or after.
            </p>
            <br/>
            <p style={{ marginTop: 12, color: '#333' }}>
              <b>Happy Solving!</b>
            </p>
          </div>
          <div style={{ flex: '0 0 350px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ width: '100%', marginTop: 12 }}>
              <img src="/demoNonogram.gif" alt="Demo Nonogram" style={{ width: '100%', borderRadius: 8 }} />
            </div>
          </div>
            <br/>
            <h3 style={{ fontSize: 22, marginTop: 0, marginBottom: 0, fontWeight: 800 }}>TIPS AND TRICKS</h3>

              <ol style={{ margin: 12 }}>
                <li style={{ marginBottom: 30 }}><b>Look for overlaps:</b> For example, if a row has a clue of “8”, the squares that overlap in the middle must be filled, giving you a starting point!
                  <img src="/overlapDemo.png" alt="Overlap Example" style={{ width: '100%', marginTop: 8, borderRadius: 6 }} />
                </li>
                <li style={{ marginBottom: 30 }}><b>Use <b style={{color: '#ff0404'}}>X</b> to mark empty squares:</b> This helps you visualize potential placements for filled squares and avoid mistakes. <b style={{ color: '#ff0404' }}>X</b> squares can't be filled by accident when sliding around in fill mode.</li>
                <li style={{ marginBottom: 30 }}><b>Combine these techniques to unlock more knowledge:</b> <b style={{color: '#ff0404'}}>X</b> squares can lead to more overlaps which can help you deduce the placement of other filled squares.
                  <img src="/overlapDemo2.png" alt="Overlap + X Example" style={{ width: '100%', marginTop: 8, borderRadius: 6 }} />
                </li> 
                <li style={{ marginBottom: 30 }}><b>Sometimes you have to count it out:</b> You can use the overlap technique in rows with multiple numbers, just account for spaces.
                  <img src="/overlapDemo3.png" alt="Count It Out Example" style={{ width: '100%', marginTop: 8, borderRadius: 6 }} />
                </li>
                <li style={{ marginBottom: 30 }}><b>Cross-reference rows and columns:</b> Each time you confidently fill in squares in a row, check the intersecting columns for new information, and vice versa.</li>
                <li style={{ marginBottom: 30 }}><b>It's all about deduction:</b> If you don't know which square to fill next, figure out which squares definitely won't be filled. Eliminating options will make the solution clearer.</li>
              </ol>

        </div>
      </div>
      <style jsx>{`
        .difficulty-row {
          display: flex;
          gap: 40px;
          margin: 50px;
          align-items: flex-end;
          flex-wrap: nowrap;
          justify-content: center;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        @media (max-width: 600px) {
          .difficulty-row {
            flex-direction: column;
            align-items: center;
            gap: 16px;
            margin: 24px;
          }
          .nonogram-difficulty-btn {
            width: 100%;
            max-width: 320px;
          }
        }
        .nonogram-difficulty-btn {
          border: 3px solid #7c7c7c;
          transition: border-color 120ms, transform 120ms, box-shadow 120ms;
          min-width: 160px;
        }
        .nonogram-difficulty-btn:not(.disabled):hover {
          border: 3px solid #0070f3 !important;
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(3,102,214,0.12);
        }
      `}</style>
    </div>
  );
}

