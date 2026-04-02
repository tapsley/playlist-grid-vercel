"use client";
import React from "react";

type Props = {
  clue: number[];
  fulfilled: boolean[];
  cellPx: number;
  topHeight: number | string;
  fontSize: number | string;
  index: number;
  firstStart?: boolean;
};

export default function ClueColumn({ clue, fulfilled, cellPx, topHeight, fontSize, index, firstStart }: Props) {
  return (
    <div style={{ width: cellPx, minHeight: topHeight, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', fontSize: fontSize, marginBottom: 0, paddingBottom: 2, background: (index % 2 === 0) ? '#e8e8e8' : '#ffffff' }}>
      {clue.map((n, j) => (
        <div key={j} className="clue-number" style={{ color: fulfilled[j] ? '#a3a3a3' : '#000', opacity: firstStart ? 0 : undefined }}>{n}</div>
      ))}
    </div>
  );
}
