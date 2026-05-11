"use client";
import React, { useEffect, useRef, useState } from 'react';

interface Streak { current: number; max: number; }

interface StatsData {
  easy: number;
  medium: number;
  hard: number;
  fastest: { easy: number | null; medium: number | null; hard: number | null };
  streaks: { easy: Streak; medium: Streak; hard: Streak };
  todayDistribution?: { easy: number[]; medium: number[]; hard: number[] };
  myTodaySeconds?: { easy: number | null; medium: number | null; hard: number | null };
  admin?: {
    today: { easy: number; medium: number; hard: number; total: number; users: Array<{ email: string; easy: number | null; medium: number | null; hard: number | null }> };
    perDate: Array<{ date: string; easy: number; medium: number; hard: number; total: number; avgEasy: number | null; avgMedium: number | null; avgHard: number | null }>;
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

const DIFFICULTIES = [
  { key: 'easy',   label: 'Easy',   icon: '/easyIcon.jpg' },
  { key: 'medium', label: 'Medium', icon: '/mediumIcon.jpg' },
  { key: 'hard',   label: 'Hard',   icon: '/hardIcon.jpg' },
] as const;

function fmtTime(sec: number | null | undefined): string {
  if (sec == null || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function StatCell({ value, label }: { value: number | null | undefined; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 }}>
      <span style={{ fontSize: 30, fontWeight: 700, fontFamily: 'Courier New', color: '#fff', lineHeight: 1 }}>
        {value ?? 0}
      </span>
      <span style={{ fontSize: 13, color: '#fff', fontFamily: 'Courier New', marginTop: 4, textAlign: 'center' }}>
        {label}
      </span>
    </div>
  );
}

// ─── Histogram helpers ───────────────────────────────────────────────────────

const CHART_H = 110; // px — height of the bars area

function computeBuckets(times: number[]): { buckets: { start: number; count: number }[]; bucketSize: number } {
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

function SolveHistogram({ times, myTime }: { times: number[]; myTime: number | null }) {
  const [animated, setAnimated] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timerRef.current = setTimeout(() => setAnimated(true), 50);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  if (times.length === 0) {
    return (
      <div style={{ height: CHART_H + 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 13, fontStyle: 'italic' }}>
        No solves yet today
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
      {/* Arrow row — sits above the bars, always visible */}
      <div style={{ display: 'flex', height: 16, marginBottom: 2 }}>
        {buckets.map((_, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {i === myBucketIdx && (
              <span style={{ fontSize: 12, color: '#f9c74f', fontWeight: 700, lineHeight: 1, userSelect: 'none' }}>&#9660;</span>
            )}
          </div>
        ))}
      </div>
      {/* Bar area */}
      <div style={{ display: 'flex', alignItems: 'flex-end', height: CHART_H, gap: 2 }}>
        {buckets.map((b, i) => {
          const isMe = i === myBucketIdx;
          const targetH = b.count > 0 ? Math.max((b.count / maxCount) * CHART_H, 4) : 0;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', position: 'relative' }}>
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
      {/* Axis line */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.2)' }} />
      {/* X labels */}
      <div style={{ display: 'flex', marginTop: 3 }}>
        {buckets.map((b, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: '#888', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {i % labelEvery === 0 ? fmtTime(b.start) : ''}
          </div>
        ))}
      </div>
      {/* User legend */}
      {myBucketIdx >= 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 11, color: '#f9c74f' }}>
          <span>&#9660;</span>
          <span>Your time: {fmtTime(myTime)}</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

// Module-level cache — populated by prefetchStats() on splash mount
let _cache: { data: StatsData } | null = null;

/** Call this on splash page mount to warm the cache before the popup opens. */
export async function prefetchStats(): Promise<void> {
  try {
    const res = await fetch('/api/picross/stats');
    if (res.ok) _cache = { data: await res.json() };
  } catch { /* ignore */ }
}

export default function StatsModal({ open, onClose, isAdmin }: Props) {
  const [stats, setStats] = useState<StatsData | null>(() => _cache?.data ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usersPage, setUsersPage] = useState(0);
  const [histPage, setHistPage] = useState(0);
  const USERS_PER_PAGE = 10;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setUsersPage(0);
    setHistPage(0);
    // If already cached from prefetch, show immediately and refresh in background
    if (_cache) setStats(_cache.data);
    (async () => {
      try {
        const res = await fetch('/api/picross/stats');
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        _cache = { data };
        setStats(data);
        setError(null);
      } catch {
        if (!_cache) setError('Could not load stats.');
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  if (!open) return null;

  const visibleDiffs = isAdmin
    ? DIFFICULTIES
    : DIFFICULTIES.filter(d => d.key !== 'hard');

  const modalStyle: React.CSSProperties = {
    background: '#2c2c2c',
    padding: 18,
    borderRadius: 8,
    minWidth: 300,
    maxWidth: 420,
    width: '90vw',
    border: '1px solid rgba(255,255,255,0.06)',
    fontFamily: 'Courier New',
    color: '#fff',
    maxHeight: '90vh',
    overflowY: 'auto',
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', zIndex: 2000 }}
    >
      <div onClick={e => e.stopPropagation()} style={modalStyle}>
        <div style={{ fontWeight: 700, marginBottom: 16, color: '#fff', letterSpacing: '0.2em', fontSize: 16 }}>STATS</div>

        {loading && <div style={{ color: '#fff', fontSize: 14 }}>Loading...</div>}
        {error && <div style={{ color: '#f88', fontSize: 14 }}>{error}</div>}

        {stats && !loading && (
          <>
            {/* Difficulty rows */}
            {visibleDiffs.map(({ key, label, icon }) => {
              const solved = stats[key as 'easy' | 'medium' | 'hard'] ?? 0;
              const streak = stats.streaks?.[key as 'easy' | 'medium' | 'hard'] ?? { current: 0, max: 0 };
              return (
                <div
                  key={key}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <img
                    src={icon}
                    alt={label}
                    style={{ width: 110, height: 110, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                  />
                  <div style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'space-around' }}>
                    <StatCell value={solved} label={solved === 1 ? "Puzzle Solved" : "Puzzles Solved"} />
                    <StatCell value={streak.current} label="Current Streak" />
                    <StatCell value={streak.max} label="Longest Streak" />
                  </div>
                </div>
              );
            })}

            {/* Solve Distribution */}
            {stats.todayDistribution && (
              <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 11, color: '#fff', letterSpacing: '0.1em', marginBottom: 10 }}>TODAY&apos;S DISTRIBUTION</div>
                {/* Difficulty pager */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <button
                    onClick={() => setHistPage(p => Math.max(0, p - 1))}
                    disabled={histPage === 0}
                    style={{ background: 'none', border: 'none', color: histPage === 0 ? '#444' : '#fff', cursor: histPage === 0 ? 'default' : 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}
                  >&#8592;</button>
                  <span style={{ fontSize: 13, color: '#fff', fontWeight: 600, letterSpacing: '0.08em' }}>
                    {visibleDiffs[histPage]?.label.toUpperCase()}
                  </span>
                  <button
                    onClick={() => setHistPage(p => Math.min(visibleDiffs.length - 1, p + 1))}
                    disabled={histPage === visibleDiffs.length - 1}
                    style={{ background: 'none', border: 'none', color: histPage === visibleDiffs.length - 1 ? '#444' : '#fff', cursor: histPage === visibleDiffs.length - 1 ? 'default' : 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}
                  >&#8594;</button>
                </div>
                {/* Dot indicators */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 8 }}>
                  {visibleDiffs.map((_, i) => (
                    <div key={i} onClick={() => setHistPage(i)} style={{ width: 6, height: 6, borderRadius: '50%', background: i === histPage ? '#cca3ff' : '#555', cursor: 'pointer' }} />
                  ))}
                </div>
                {/* Chart — key on diff so it remounts (and re-animates) per page */}
                {(() => {
                  const diff = visibleDiffs[histPage]?.key;
                  if (!diff) return null;
                  const times = stats.todayDistribution[diff as keyof typeof stats.todayDistribution] ?? [];
                  const myTime = stats.myTodaySeconds?.[diff as keyof typeof stats.myTodaySeconds] ?? null;
                  return <SolveHistogram key={diff} times={times} myTime={myTime} />;
                })()}
              </div>
            )}

            {/* Admin section */}
            {isAdmin && stats.admin && (
              <div style={{ marginTop: 20, paddingTop: 14, borderTop: '2px solid rgba(255,255,255,0.15)' }}>
                <div style={{ fontWeight: 700, letterSpacing: '0.15em', fontSize: 13, color: '#cca3ff', marginBottom: 12 }}>
                  ADMIN
                </div>

                {/* Today's counts */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: '#fff', marginBottom: 8, letterSpacing: '0.1em' }}>TODAY</div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    {(['easy', 'medium', 'hard'] as const).map(d => (
                      <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>
                          {stats.admin!.today[d]}
                        </span>
                        <span style={{ fontSize: 11, color: '#fff', marginTop: 3, textTransform: 'capitalize' }}>{d}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Users who solved today */}
                {stats.admin.today.users && stats.admin.today.users.length > 0 && (() => {
                  const users = stats.admin.today.users;
                  const totalPages = Math.ceil(users.length / USERS_PER_PAGE);
                  const page = Math.min(usersPage, totalPages - 1);
                  const visible = users.slice(page * USERS_PER_PAGE, (page + 1) * USERS_PER_PAGE);
                  return (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ fontSize: 11, color: '#fff', letterSpacing: '0.1em' }}>SOLVED TODAY ({users.length})</div>
                        {totalPages > 1 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#cca3ff' }}>
                            <button onClick={() => setUsersPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ background: 'none', border: 'none', color: page === 0 ? '#555' : '#cca3ff', cursor: page === 0 ? 'default' : 'pointer', fontSize: 14, padding: 0 }}>&#8592;</button>
                            <span>{page + 1} / {totalPages}</span>
                            <button onClick={() => setUsersPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} style={{ background: 'none', border: 'none', color: page === totalPages - 1 ? '#555' : '#cca3ff', cursor: page === totalPages - 1 ? 'default' : 'pointer', fontSize: 14, padding: 0 }}>&#8594;</button>
                          </div>
                        )}
                      </div>
                      {visible.map((u) => (
                        <div key={u.email} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#fff', paddingBottom: 4 }}>
                          <span>{u.email}</span>
                          <span style={{ color: '#cca3ff', fontFamily: 'Courier New', marginLeft: 12, whiteSpace: 'nowrap' }}>
                            {[u.easy, u.medium, u.hard]
                              .map((s, i) => s != null ? `${['E','M','H'][i]} ${fmtTime(s)}` : null)
                              .filter(Boolean)
                              .join('  ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Last 7 days */}
                {stats.admin.perDate && stats.admin.perDate.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: '#fff', marginBottom: 6, letterSpacing: '0.1em' }}>LAST 7 DAYS</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ color: '#fff' }}>
                          <th style={{ textAlign: 'left', paddingBottom: 6, fontWeight: 400 }}>Date</th>
                          <th style={{ textAlign: 'center', paddingBottom: 6, fontWeight: 400 }}>Easy</th>
                          <th style={{ textAlign: 'center', paddingBottom: 6, fontWeight: 400 }}>Med</th>
                          <th style={{ textAlign: 'center', paddingBottom: 6, fontWeight: 400 }}>Hard</th>
                          <th style={{ textAlign: 'center', paddingBottom: 6, fontWeight: 400 }}>Total</th>
                          <th style={{ textAlign: 'center', paddingBottom: 6, fontWeight: 400, color: '#cca3ff' }}>Avg E</th>
                          <th style={{ textAlign: 'center', paddingBottom: 6, fontWeight: 400, color: '#cca3ff' }}>Avg M</th>
                          <th style={{ textAlign: 'center', paddingBottom: 6, fontWeight: 400, color: '#cca3ff' }}>Avg H</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.admin.perDate.map(row => (
                          <tr key={row.date} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <td style={{ paddingTop: 5, paddingBottom: 5, color: '#fff' }}>{row.date.slice(5)}</td>
                            <td style={{ textAlign: 'center', color: '#fff' }}>{row.easy}</td>
                            <td style={{ textAlign: 'center', color: '#fff' }}>{row.medium}</td>
                            <td style={{ textAlign: 'center', color: '#fff' }}>{row.hard}</td>
                            <td style={{ textAlign: 'center', color: '#fff', fontWeight: 700 }}>{row.total}</td>
                            <td style={{ textAlign: 'center', color: '#cca3ff' }}>{fmtTime(row.avgEasy)}</td>
                            <td style={{ textAlign: 'center', color: '#cca3ff' }}>{fmtTime(row.avgMedium)}</td>
                            <td style={{ textAlign: 'center', color: '#cca3ff' }}>{fmtTime(row.avgHard)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{ cursor: 'pointer', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: '#111', color: '#fff', fontFamily: 'Courier New' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
