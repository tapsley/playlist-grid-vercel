"use client";
import React from 'react';

export default function TimerWithPB({ elapsedSec, cleared, showNewPB }: { elapsedSec: number; cleared: boolean; showNewPB: boolean }) {
  const formatSec = (s: number) => {
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = Math.floor(s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  return (
    <>
      <div style={{ fontSize: 29, fontFamily: 'monospace', marginTop: 15, color: cleared ? 'gold' : 'inherit' }}>{formatSec(elapsedSec)}</div>
      {showNewPB && (
        <div style={{ marginTop: 8, color: '#1f8f2f', fontWeight: 700, fontSize: 14 }}>
          New personal best!
        </div>
      )}
    </>
  );
}
