"use client";
import React, { useEffect, useState } from 'react';

interface Streak { current: number; max: number; }

interface StatsData {
  easy: number;
  medium: number;
  hard: number;
  fastest: { easy: number | null; medium: number | null; hard: number | null };
  streaks: { easy: Streak; medium: Streak; hard: Streak };
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
  const USERS_PER_PAGE = 10;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setUsersPage(0);
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
