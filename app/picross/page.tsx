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
      <h1 style={{ fontSize: 56, lineHeight: 1, margin: 25, fontWeight: 800, letterSpacing: 1, color: '#111' }}>Daily Picross</h1>
      <div style={{ display: "flex", gap: 40, margin: 50, alignItems: 'flex-end' }}>
        {difficulties.map(d => {
          const disabled = d.value !== 'easy' && !isTyler;
          const containerStyle: React.CSSProperties = { border: "3px solid #7c7c7c", borderRadius: 12, background: "#fff", padding: 12, cursor: disabled ? 'default' : 'pointer', display: "inline-block", position: 'relative' };
          return (
            <div key={d.value} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {disabled ? (
                <div className="picross-difficulty-btn disabled" style={containerStyle}>
                  <DifficultyIcon grid={typedPuzzle[d.value] ?? demoPuzzles[d.value]} progress={typedProgress[d.value] || undefined} size={140} celebrate={isCompleted(d.value)} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.8)', borderRadius: 8, fontWeight: 700, color: '#333' }}>Coming soon</div>
                </div>
              ) : (
                <Link
                  href={`/picross/play?difficulty=${d.value}`}
                  className="picross-difficulty-btn"
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
      <style jsx>{`
        .picross-difficulty-btn {
          border: 3px solid #7c7c7c;
          transition: border-color 120ms, transform 120ms, box-shadow 120ms;
        }
        .picross-difficulty-btn:not(.disabled):hover {
          border: 3px solid #0070f3 !important;
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(3,102,214,0.12);
        }
      `}</style>
    </div>
  );
}

