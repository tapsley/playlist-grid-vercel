"use client";
import React, { useEffect, useState } from 'react';
import SolveHistogram, { fmtTime } from './SolveHistogram';
import MedalIcon from './MedalIcon';

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  gold: number;
  isMe: boolean;
}
interface LeaderboardData {
  easy: LeaderboardEntry[];
  medium: LeaderboardEntry[];
  hard: LeaderboardEntry[];
  month: string;
}

interface Streak { current: number; max: number; }

interface AdminData {
  today: { easy: number; medium: number; hard: number; total: number; pastSolves: { easy: number; medium: number; hard: number }; users: Array<{ email: string; easy: number | null; medium: number | null; hard: number | null; updatedAt?: string }> };
  monthlyUniqueUsers: number;
  newUsersThisMonth: number;
  perDate: Array<{ date: string; easy: number; medium: number; hard: number; total: number; avgEasy: number | null; avgMedium: number | null; avgHard: number | null }>;
}

interface StatsData {
  easy: number;
  medium: number;
  hard: number;
  fastest: { easy: number | null; medium: number | null; hard: number | null };
  streaks: { easy: Streak; medium: Streak; hard: Streak };
  medals?: {
    goldEasy: number; goldMedium: number; goldHard: number;
    silverEasy: number; silverMedium: number; silverHard: number;
  };
  yesterdayMedals?: Array<{ difficulty: string; type: string }>;
  todayDistribution?: { easy: number[]; medium: number[]; hard: number[] };
  todayAvg?: { easy: { avg: number | null; count: number }; medium: { avg: number | null; count: number }; hard: { avg: number | null; count: number } };
  myTodaySeconds?: { easy: number | null; medium: number | null; hard: number | null };
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

// ─────────────────────────────────────────────────────────────────────────────

// Module-level caches
let _cache: { data: StatsData } | null = null;
let _leaderboardCache: LeaderboardData | null = null;
let _adminCache: AdminData | null = null;

/** Call this on splash page mount to warm the cache before the popup opens. */
export async function prefetchStats(): Promise<void> {
  try {
    const res = await fetch('/api/picross/stats');
    if (res.ok) _cache = { data: await res.json() };
  } catch { /* ignore */ }
}

/** Call this on splash page mount to warm the leaderboard cache in the background. */
export async function prefetchLeaderboard(): Promise<void> {
  try {
    const res = await fetch('/api/picross/leaderboard');
    if (res.ok) _leaderboardCache = await res.json();
  } catch { /* ignore */ }
}

/** Returns medals the user earned yesterday, from the prefetch cache. */
export function getYesterdayMedals(): Array<{ difficulty: string; type: string }> {
  return _cache?.data?.yesterdayMedals ?? [];
}

export default function StatsModal({ open, onClose, isAdmin }: Props) {
  const [stats, setStats] = useState<StatsData | null>(() => _cache?.data ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usersPage, setUsersPage] = useState(0);
  const [activeTab, setActiveTab] = useState<'stats' | 'leaderboard' | 'admin'>('leaderboard');
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(() => _leaderboardCache);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardDiffPage, setLeaderboardDiffPage] = useState(0);
  const [adminData, setAdminData] = useState<AdminData | null>(() => _adminCache);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState(false);
  const USERS_PER_PAGE = 10;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setUsersPage(0);
    setActiveTab('leaderboard');
    if (_cache) setStats(_cache.data);
    else setLoading(true);
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

  useEffect(() => {
    if (!open || activeTab !== 'leaderboard') return;
    if (_leaderboardCache) { setLeaderboard(_leaderboardCache); return; }
    setLeaderboardLoading(true);
    (async () => {
      try {
        const res = await fetch('/api/picross/leaderboard');
        if (!res.ok) throw new Error('failed');
        const data: LeaderboardData = await res.json();
        _leaderboardCache = data;
        setLeaderboard(data);
      } catch { /* leave null */ } finally {
        setLeaderboardLoading(false);
      }
    })();
  }, [open, activeTab]);

  useEffect(() => {
    if (!open || activeTab !== 'admin') return;
    if (_adminCache) { setAdminData(_adminCache); return; }
    setAdminLoading(true);
    setAdminError(false);
    (async () => {
      try {
        const res = await fetch('/api/picross/admin-stats');
        if (!res.ok) throw new Error('failed');
        const data: AdminData = await res.json();
        _adminCache = data;
        setAdminData(data);
      } catch { setAdminError(true); } finally {
        setAdminLoading(false);
      }
    })();
  }, [open, activeTab]);

  if (!open) return null;

  const visibleDiffs = DIFFICULTIES;

  const modalStyle: React.CSSProperties = {
    background: '#2c2c2c',
    padding: 18,
    borderRadius: 8,
    minWidth: 300,
    maxWidth: 420,
    width: '90vw',
    minHeight: 420,
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
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
          {(['stats', 'leaderboard', ...(isAdmin ? ['admin'] : [])] as ('stats' | 'leaderboard' | 'admin')[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px 16px 10px',
                fontFamily: 'Courier New', fontWeight: 700, fontSize: 13,
                letterSpacing: '0.15em', textTransform: 'uppercase',
                color: activeTab === tab ? '#cca3ff' : '#888',
                borderBottom: activeTab === tab ? '2px solid #cca3ff' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {tab === 'stats' ? 'My Stats' : tab === 'leaderboard' ? 'Leaderboard' : 'Admin'}
            </button>
          ))}
        </div>

        {activeTab === 'leaderboard' && (
          <div>
            {leaderboardLoading && <div style={{ color: '#888', fontSize: 13 }}>Loading...</div>}
            {!leaderboardLoading && !leaderboard && <div style={{ color: '#f88', fontSize: 13 }}>Could not load leaderboard.</div>}
            {leaderboard && (() => {
              const LDIFFS = ['easy', 'medium', 'hard'] as const;
              const page = leaderboardDiffPage;
              const diff = LDIFFS[page];
              const entries = leaderboard[diff];
              return (
                <>
                  {/* Difficulty pager — matches histogram style */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <button
                      onClick={() => setLeaderboardDiffPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      style={{ background: 'none', border: 'none', color: page === 0 ? '#444' : '#fff', cursor: page === 0 ? 'default' : 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}
                    >&#8592;</button>
                    <span style={{ fontSize: 13, color: '#fff', fontWeight: 600, letterSpacing: '0.08em' }}>
                      {diff.toUpperCase()}
                    </span>
                    <button
                      onClick={() => setLeaderboardDiffPage(p => Math.min(LDIFFS.length - 1, p + 1))}
                      disabled={page === LDIFFS.length - 1}
                      style={{ background: 'none', border: 'none', color: page === LDIFFS.length - 1 ? '#444' : '#fff', cursor: page === LDIFFS.length - 1 ? 'default' : 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}
                    >&#8594;</button>
                  </div>
                  {/* Dot indicators */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 10 }}>
                    {LDIFFS.map((_, i) => (
                      <div key={i} onClick={() => setLeaderboardDiffPage(i)} style={{ width: 6, height: 6, borderRadius: '50%', background: i === page ? '#cca3ff' : '#555', cursor: 'pointer' }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: '#fff', letterSpacing: '0.12em', marginBottom: 10 }}>
                    FASTEST SOLVERS IN {leaderboard.month.toUpperCase()}
                  </div>
                  <div style={{ minHeight: 202 }}>
                    {entries.length === 0 && (
                      <div style={{ color: '#888', fontSize: 13 }}>No gold medals yet this month.</div>
                    )}
                    {entries.map((entry: LeaderboardEntry) => (
                      <div
                        key={entry.rank}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '7px 8px', borderRadius: 6, marginBottom: 3,
                          background: entry.isMe ? 'rgba(204,163,255,0.12)' : 'transparent',
                        }}
                      >
                        <span style={{ width: 24, textAlign: 'right', fontSize: 13, color: '#888', flexShrink: 0 }}>
                          {`#${entry.rank}`}
                        </span>
                        <span style={{ flex: 1, fontSize: 14, fontWeight: entry.isMe ? 700 : 400, color: entry.isMe ? '#cca3ff' : '#fff', letterSpacing: 0.2 }}>
                          {entry.displayName}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          <MedalIcon type="gold" size={16} /> {entry.gold}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Solve Distribution — uses same difficulty pager */}
                  {stats?.todayDistribution && (() => {
                    const times = stats.todayDistribution[diff as keyof typeof stats.todayDistribution] ?? [];
                    const myTime = stats.myTodaySeconds?.[diff as keyof typeof stats.myTodaySeconds] ?? null;
                    const avg = stats.todayAvg?.[diff as keyof typeof stats.todayAvg]?.avg ?? null;
                    return (
                      <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ fontSize: 11, color: '#fff', letterSpacing: '0.1em', marginBottom: 10 }}>TODAY&apos;S DISTRIBUTION</div>
                        <SolveHistogram key={diff} times={times} myTime={myTime} avg={avg} />
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </div>
        )}

        {activeTab === 'stats' && loading && <div style={{ color: '#fff', fontSize: 14 }}>Loading...</div>}
        {activeTab === 'stats' && error && <div style={{ color: '#f88', fontSize: 14 }}>{error}</div>}

        {activeTab === 'stats' && stats && !loading && (
          <>
            {/* Difficulty rows */}
            {visibleDiffs.map(({ key, label, icon }) => {
              const solved = stats[key as 'easy' | 'medium' | 'hard'] ?? 0;
              const streak = stats.streaks?.[key as 'easy' | 'medium' | 'hard'] ?? { current: 0, max: 0 };
              const capKey = key.charAt(0).toUpperCase() + key.slice(1) as 'Easy' | 'Medium' | 'Hard';
              const gold = stats.medals?.[`gold${capKey}` as keyof typeof stats.medals] ?? 0;
              const silver = stats.medals?.[`silver${capKey}` as keyof typeof stats.medals] ?? 0;
              return (
                <div
                  key={key}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '27px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <img
                    src={icon}
                    alt={label}
                    style={{ width: 110, height: 110, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 8 }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'space-around' }}>
                      <StatCell value={solved} label={solved === 1 ? "Puzzle Solved" : "Puzzles Solved"} />
                      <StatCell value={streak.current} label="Current Streak" />
                      <StatCell value={streak.max} label="Longest Streak" />
                    </div>
                    {(gold > 0 || silver > 0) && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 35 }}>
                        {gold > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}><MedalIcon type="gold" size={16} /> {gold}</span>}
                        {silver > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}><MedalIcon type="silver" size={16} /> {silver}</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {activeTab === 'admin' && isAdmin && (() => {
          if (adminLoading) return <div style={{ color: '#888', fontSize: 13 }}>Loading...</div>;
          if (adminError) return <div style={{ color: '#f88', fontSize: 13 }}>Could not load admin stats.</div>;
          if (!adminData) return null;
          const admin = adminData;
          const users = [...admin.today.users].sort((a, b) => {
            if (!a.updatedAt || !b.updatedAt) return 0;
            return a.updatedAt < b.updatedAt ? -1 : a.updatedAt > b.updatedAt ? 1 : 0;
          });
          const totalPages = Math.ceil(users.length / USERS_PER_PAGE);
          const page = Math.min(usersPage, totalPages - 1);
          const visible = users.slice(page * USERS_PER_PAGE, (page + 1) * USERS_PER_PAGE);
          const fastestEasy   = users.reduce((m, u) => u.easy   != null && (m == null || u.easy   < m) ? u.easy   : m, null as number | null);
          const fastestMedium = users.reduce((m, u) => u.medium != null && (m == null || u.medium < m) ? u.medium : m, null as number | null);
          const fastestHard   = users.reduce((m, u) => u.hard   != null && (m == null || u.hard   < m) ? u.hard   : m, null as number | null);
          const fastestByDiff = [fastestEasy, fastestMedium, fastestHard];
          return (
            <div>
              {/* Today's counts */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: '#fff', marginBottom: 8, letterSpacing: '0.1em' }}>TODAY</div>
                <div style={{ display: 'flex', gap: 20 }}>
                  {(['easy', 'medium', 'hard'] as const).map(d => (
                    <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{admin.today[d]}</span>
                      <span style={{ fontSize: 11, color: '#fff', marginTop: 3, textTransform: 'capitalize' }}>{d}</span>
                    </div>
                  ))}
                  {(['easy', 'medium', 'hard'] as const).some(d => admin.today.pastSolves[d] > 0) && (
                    <>
                      <div style={{ width: 1, background: 'rgba(255,255,255,0.15)', alignSelf: 'stretch', margin: '0 8px' }} />
                      {(['easy', 'medium', 'hard'] as const).map(d => admin.today.pastSolves[d] > 0 && (
                        <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: '#cca3ff' }}>{admin.today.pastSolves[d]}</span>
                          <span style={{ fontSize: 11, color: '#cca3ff', marginTop: 3, textTransform: 'capitalize' }}>↩{d.slice(0, 1).toUpperCase()}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Monthly stats */}
              {admin.monthlyUniqueUsers != null && (
                <div style={{ marginBottom: 4, fontSize: 12, color: '#aaa' }}>
                  THIS MONTH: <span style={{ color: '#cca3ff', fontWeight: 700 }}>{admin.monthlyUniqueUsers}</span> unique {admin.monthlyUniqueUsers === 1 ? 'player' : 'players'}
                </div>
              )}
              {admin.newUsersThisMonth != null && (
                <div style={{ marginBottom: 14, fontSize: 12, color: '#aaa' }}>
                  NEW THIS MONTH: <span style={{ color: '#cca3ff', fontWeight: 700 }}>{admin.newUsersThisMonth}</span>
                </div>
              )}

              {/* Users who solved today */}
              {users.length > 0 && (
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
                      <span style={{ fontFamily: 'Courier New', marginLeft: 12, whiteSpace: 'nowrap' }}>
                        {([u.easy, u.medium, u.hard] as (number | null)[]).map((s, i) => {
                          if (s == null) return null;
                          const isFastest = fastestByDiff[i] != null && s === fastestByDiff[i];
                          return (
                            <span key={i} style={{ color: isFastest ? '#f9c74f' : '#cca3ff', marginLeft: i > 0 ? 8 : 0 }}>
                              {['E','M','H'][i]} {fmtTime(s)}
                            </span>
                          );
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Last 7 days */}
              {admin.perDate && admin.perDate.length > 0 && (
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
                      {admin.perDate.map((row) => (
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
          );
        })()}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{ cursor: 'pointer', padding: '8px 10px', borderRadius: 6, border: 'none', background: '#cca3ff', color: '#1a0a2e', fontFamily: 'Courier New', fontWeight: 700 }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
