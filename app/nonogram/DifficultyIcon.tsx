import React from "react";
import type { CellState } from "./PicrossPrefetchContext";

interface DifficultyIconProps {
  grid: boolean[][];
  progress?: CellState[][]; // 0 empty, 1 filled, 2 maybe, 3 X
  size?: number; // px
  celebrate?: boolean;
}

export default function DifficultyIcon({ grid, progress, size, celebrate }: DifficultyIconProps) {
  const n = grid.length;
  if (typeof size === 'number') {
    const cellSize = size / n;
    return (
      <svg width={size} height={size} style={{ border: "1px solid #000000", background: "#fff", borderRadius: 6 }}>
        {grid.map((row, r) =>
          row.map((cell, c) => {
            let fill = "#fff";
            const val = progress && progress[r] ? (progress[r][c] as CellState) : 0;
            if (val === 1) fill = celebrate ? '#d4af37' : '#222';
            else if (val === 2) fill = "#f0f0f0";
            else if (val === 3) fill = "#fff";
            return (
              <g key={`${r}-${c}`}>
                <rect
                  x={c * cellSize}
                  y={r * cellSize}
                  width={cellSize}
                  height={cellSize}
                  fill={fill}
                  stroke="#888"
                  strokeWidth={0.5}
                  rx={2}
                />
                {val === 3 && (
                  <text
                    x={c * cellSize + cellSize / 2}
                    y={r * cellSize + cellSize / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={cellSize * 0.7}
                    fill="#c00"
                    style={{ fontWeight: 800 }}
                    transform={`translate(0,2)`}
                  >
                    ✕
                  </text>
                )}
                {val === 2 && (
                  <circle
                    cx={c * cellSize + cellSize / 2}
                    cy={r * cellSize + cellSize / 2}
                    r={Math.max(1, cellSize * 0.12)}
                    fill="#666"
                  />
                )}
              </g>
            );
          })
        )}
      </svg>
    );
  }

  // Responsive (no explicit size): use viewBox in grid units
  return (
    <svg viewBox={`0 0 ${n} ${n}`} style={{ border: "1px solid #000000", background: "#fff", borderRadius: 6, width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      {grid.map((row, r) =>
        row.map((cell, c) => {
          let fill = "#fff";
          const val = progress && progress[r] ? (progress[r][c] as CellState) : 0;
          if (val === 1) fill = celebrate ? '#d4af37' : '#222';
          else if (val === 2) fill = "#f0f0f0";
          else if (val === 3) fill = "#fff";
          return (
            <g key={`${r}-${c}`}>
              <rect x={c} y={r} width={1} height={1} fill={fill} stroke="#888" strokeWidth={0.05} rx={0.12} />
              {val === 3 && (
                <text x={c + 0.5} y={r + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={0.7} fill="#c00" style={{ fontWeight: 800 }} transform={`translate(0,0.08)`}>✕</text>
              )}
              {val === 2 && (
                <circle cx={c + 0.5} cy={r + 0.5} r={0.12} fill="#666" />
              )}
            </g>
          );
        })
      )}
    </svg>
  );
}
