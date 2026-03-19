import React from "react";

interface DifficultyIconProps {
  grid: boolean[][];
  progress?: number[][]; // 0: empty, 1: filled, 2: X
  size?: number; // px
}

export default function DifficultyIcon({ grid, progress, size = 40 }: DifficultyIconProps) {
  const n = grid.length;
  const cellSize = size / n;
  return (
    <svg width={size} height={size} style={{ border: "1px solid #aaa", background: "#fff", borderRadius: 6 }}>
      {grid.map((row, r) =>
        row.map((cell, c) => {
          let fill = "#fff";
          if (progress && progress[r][c] === 1) fill = "#222";
          else if (progress && progress[r][c] === 2) fill = "#eee";
          else if (cell) fill = "#bbb";
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
              {progress && progress[r][c] === 2 && (
                <text
                  x={c * cellSize + cellSize / 2}
                  y={r * cellSize + cellSize / 2 + 2}
                  textAnchor="middle"
                  fontSize={cellSize * 0.7}
                  fill="#c00"
                >
                  ✕
                </text>
              )}
            </g>
          );
        })
      )}
    </svg>
  );
}
