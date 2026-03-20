"use client";


import { usePicrossPrefetch } from "./PicrossPrefetchContext";
  

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import DifficultyIcon from "./DifficultyIcon";
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



  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 0, paddingTop: 24, position: "relative", background: '#cca3ff', minHeight: '100vh', width: '100%' }}>
      <div style={{ position: "absolute", top: 16, right: 24 }}>
        <UserMenu />
      </div>
      <h1 style={{ fontSize: 56, lineHeight: 1, margin: 25, fontWeight: 800, letterSpacing: 1, color: '#111' }}>Daily Nonogram</h1>
      <div className="difficulty-row">
        {difficulties.map(d => {
          const disabled = d.value !== 'easy' && !isTyler;
          const containerStyle: React.CSSProperties = { border: "3px solid #7c7c7c", borderRadius: 12, background: "#fff", padding: 12, cursor: disabled ? 'default' : 'pointer', display: "inline-block", position: 'relative' };
          return (
            <div key={d.value} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {disabled ? (
                <div className="nonogram-difficulty-btn disabled" style={containerStyle}>
                  <DifficultyIcon grid={typedPuzzle[d.value] ?? demoPuzzles[d.value]} progress={typedProgress[d.value] || undefined} size={140} celebrate={isCompleted(d.value)} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.8)', borderRadius: 8, fontWeight: 700, color: '#333' }}>Coming soon</div>
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
              <div style={{ marginTop: 12, fontWeight: difficulty === d.value ? "bold" : 600, fontSize: 18 }}>{d.label}</div>
            </div>
          );
        })}
      </div>
      <div style={{ width: 'min(1000px, 92%)', background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 8px 30px rgba(0,0,0,0.08)', marginBottom: 48 }}>
        <h2 style={{ fontSize: 22, marginTop: 0, marginBottom: 12, fontWeight: 800 }}>HOW TO PLAY</h2>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 420px', minWidth: 260 }}>
            <p style={{ marginTop: 0, marginBottom: 12, color: '#333' }}>
              Solve the puzzle by filling the correct squares so the pattern matches the hidden picture.
              Numbers on the left and top tell you how many filled squares appear in each row and column,
              and in what order. For example, “3 1” means a run of 3 filled squares, then at least one empty, then a single filled square.
            </p>
            <ol style={{ paddingLeft: 18, marginTop: 0, color: '#333' }}>
              <li><strong>Fill:</strong> Tap or click a cell to mark it filled.</li>
              <li><strong>Maybe:</strong> Use the bottom toolbar to mark a cell as Maybe when you're unsure.</li>
              <li><strong>Mark X:</strong> Mark a cell with X to indicate it should remain empty.</li>
              <li><strong>Drag:</strong> Hold and drag to fill many cells quickly.</li>
            </ol>
            <p style={{ marginTop: 12, color: '#333' }}>
              Hints: start with rows/columns that have large numbers or few gaps. Use Maybe and X marks to keep track of possibilities.
            </p>
          </div>
          <div style={{ flex: '0 0 260px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ width: 92, height: 92, background: '#f8f8f8', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="56" height="56" viewBox="0 0 4 4" xmlns="http://www.w3.org/2000/svg">
                <rect x="0.6" y="0.6" width="2.8" height="2.8" fill="#222" rx="0.2" />
              </svg>
            </div>
            <div style={{ width: 92, height: 92, background: '#f8f8f8', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="56" height="56" viewBox="0 0 4 4" xmlns="http://www.w3.org/2000/svg">
                <circle cx="2" cy="2" r="0.6" fill="#666" />
              </svg>
            </div>
            <div style={{ width: 92, height: 92, background: '#f8f8f8', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="56" height="56" viewBox="0 0 4 4" xmlns="http://www.w3.org/2000/svg">
                <text x="2" y="2.6" textAnchor="middle" fontSize="2.8" fontWeight="700" fill="#c00">✕</text>
              </svg>
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        .difficulty-row {
          display: flex;
          gap: 40px;
          margin: 50px;
          align-items: flex-end;
          flex-wrap: wrap;
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

