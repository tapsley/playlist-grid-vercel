"use client";
import React from "react";

type Props = {
  clue: number[];
  fulfilled: boolean[];
  clueGap: number;
  fontSize: number | string;
};

export default function ClueRow({ clue, fulfilled, clueGap, fontSize }: Props) {
  return (
    <div style={{ display: 'flex', gap: clueGap, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {clue.map((n, j) => (
        <span key={j} style={{ color: fulfilled[j] ? '#a3a3a3' : '#000', fontSize }}>{n}</span>
      ))}
    </div>
  );
}
