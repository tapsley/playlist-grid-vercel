"use client";
import React from "react";

type Props = {
  clue: number[];
  fulfilled: boolean[];
  clueGap: number;
  fontSize: number | string;
  firstStart?: boolean;
};

export default function ClueRow({ clue, fulfilled, clueGap, fontSize, firstStart }: Props) {
  return (
    <div style={{ display: 'flex', gap: clueGap, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {clue.map((n, j) => (
        <span key={j} className="clue-number" style={{ color: fulfilled[j] ? '#a3a3a3' : '#000', fontSize, opacity: firstStart ? 0 : undefined }}>{n}</span>
      ))}
    </div>
  );
}
