"use client";
import React, { useState, useEffect, useRef } from 'react';

export function fmtTime(sec: number | null | undefined): string {
  if (sec == null || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const CHART_H = 110;

export function computeBuckets(times: number[]): { buckets: { start: number; count: number }[]; bucketSize: number } {
  if (times.length === 0) return { buckets: [], bucketSize: 1 };
  const mn = Math.min(...times);
  const mx = Math.max(...times);
  const STEPS = [1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300, 600];
  let bucketSize = 1;
  if (mn < mx) {
    const range = mx - mn;
    let found = false;
    for (const s of STEPS) {
      const n = Math.ceil(range / s);
      if (n >= 1 && n <= 12) { bucketSize = s; found = true; break; }
    }
    if (!found) bucketSize = STEPS[STEPS.length - 1];
  }
  const minVal = Math.floor(mn / bucketSize) * bucketSize;
  const maxVal = Math.ceil((mx + 1) / bucketSize) * bucketSize;
  const buckets: { start: number; count: number }[] = [];
  for (let start = minVal; start < maxVal; start += bucketSize) {
    buckets.push({ start, count: times.filter(t => t >= start && t < start + bucketSize).length });
  }
  return { buckets, bucketSize };
}

export default function SolveHistogram({ times, myTime, avg, hideBottomRow }: { times: number[]; myTime: number | null; avg: number | null; hideBottomRow?: boolean }) {
  const [animated, setAnimated] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timerRef.current = setTimeout(() => setAnimated(true), 50);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  if (times.length === 0) {
    return (
      <div style={{ height: CHART_H + 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 13, fontStyle: 'italic' }}>
        No solves yet
      </div>
    );
  }

  const { buckets, bucketSize } = computeBuckets(times);
  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const myBucketIdx = myTime != null
    ? buckets.findIndex(b => myTime >= b.start && myTime < b.start + bucketSize)
    : -1;
  const labelEvery = Math.max(1, Math.floor(buckets.length / 5));

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', height: 16, marginBottom: 2 }}>
        {buckets.map((_, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {i === myBucketIdx && (
              <span style={{ fontSize: 12, color: '#f9c74f', fontWeight: 700, lineHeight: 1, userSelect: 'none' }}>&#9660;</span>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', height: CHART_H, gap: 2 }}>
        {buckets.map((b, i) => {
          const isMe = i === myBucketIdx;
          const targetH = b.count > 0 ? Math.max((b.count / maxCount) * CHART_H, 4) : 0;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{
                width: '100%',
                background: isMe ? '#f9c74f' : '#9b72cf',
                borderRadius: '3px 3px 0 0',
                height: animated ? `${targetH}px` : '0px',
                transition: `height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.04}s`,
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.2)' }} />
      <div style={{ display: 'flex', marginTop: 3 }}>
        {buckets.map((b, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: '#fff', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {i % labelEvery === 0 ? fmtTime(b.start) : ''}
          </div>
        ))}
      </div>
      {!hideBottomRow && myBucketIdx >= 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, fontSize: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f9c74f' }}>
            <span>&#9660;</span>
            <span>Your time: {fmtTime(myTime)}</span>
          </div>
          {avg != null && <div style={{ color: '#aaa' }}>Average: {fmtTime(avg)}</div>}
        </div>
      )}
    </div>
  );
}
