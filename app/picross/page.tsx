"use client";


import { usePicrossPrefetch } from "./PicrossPrefetchContext";
  

import React, { useState } from "react";
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
  const { progress } = usePicrossPrefetch();
  // Ensure progress is always an object and never null
  const safeProgress = (progress && typeof progress === 'object') ? progress : {};
  const typedProgress = safeProgress as Record<string, number[][] | undefined>;
  // Prefetching and fetch-on-login are handled by PicrossPrefetchProvider



  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 64, position: "relative" }}>
      <div style={{ position: "absolute", top: 16, right: 24 }}>
        <UserMenu />
      </div>
      <h1>Daily Picross</h1>
      <div style={{ display: "flex", gap: 32, margin: 32 }}>
        {difficulties.map(d => (
          <div key={d.value} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Link
              href={`/picross/play?difficulty=${d.value}`}
              className="picross-difficulty-btn"
              style={{ border: "3px solid #7c7c7c", borderRadius: 8, background: "#fff", padding: 8, cursor: "pointer", display: "inline-block" }}
              prefetch={true}
            >
              <DifficultyIcon grid={demoPuzzles[d.value]} progress={typedProgress[d.value] || undefined} size={60} />
            </Link>
            <div style={{ marginTop: 8, fontWeight: difficulty === d.value ? "bold" : undefined }}>{d.label}</div>
          </div>
        ))}
      </div>
      <style jsx>{`
        .picross-difficulty-btn {
          border: 3px solid #7c7c7c;
        }
        .picross-difficulty-btn:hover {
          border: 3px solid #0070f3 !important;
        }
      `}</style>
    </div>
  );
}

