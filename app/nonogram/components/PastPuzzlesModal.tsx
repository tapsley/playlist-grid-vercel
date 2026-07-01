"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import SolveHistogram, { fmtTime } from "./SolveHistogram";
import DifficultyIcon from "./DifficultyIcon";
import MedalIcon from "./MedalIcon";
import type { CellState } from "../PicrossPrefetchContext";

type Difficulty = "easy" | "medium" | "hard";
type Status = "complete" | "in-progress" | "not-started";

interface DayInfo {
  date: string;
  puzzleExists: boolean;
  easy: Status;
  medium: Status;
  hard: Status;
  easyGrid?: boolean[][] | null;
  mediumGrid?: boolean[][] | null;
  hardGrid?: boolean[][] | null;
  easyProgress?: CellState[][] | null;
  mediumProgress?: CellState[][] | null;
  hardProgress?: CellState[][] | null;
  medals?: { easy: string | null; medium: string | null; hard: string | null };
}

interface DayStatsDiff {
  count: number;
  avg: number | null;
  fastest: number | null;
  myTime: number | null;
  times: number[];
  medals: {
    gold: { seconds: number; emails: string[] } | null;
    silver: { seconds: number; count: number } | null;
  };
}

interface DayStatsData {
  date: string;
  easy: DayStatsDiff;
  medium: DayStatsDiff;
  hard: DayStatsDiff;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectPuzzle: (date: string, difficulty: Difficulty) => void;
  initialYear?: number;
  initialMonth?: number;
  initialDiff?: 'easy' | 'medium' | 'hard';
  isAdmin?: boolean;
}

const COURIER_FONT = "var(--font-courier-prime), 'Courier New', monospace";
const HARD_LAUNCH_DATE = '2026-07-01';

const emptyGrids: Record<Difficulty, boolean[][]> = {
  easy:   Array.from({ length: 5  }, () => Array(5).fill(false)),
  medium: Array.from({ length: 10 }, () => Array(10).fill(false)),
  hard:   Array.from({ length: 15 }, () => Array(15).fill(false)),
};
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function PastPuzzlesModal({
  open,
  onClose,
  onSelectPuzzle,
  initialYear,
  initialMonth,
  initialDiff,
  isAdmin,
}: Props) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [year, setYear] = useState(initialYear ?? today.getFullYear());
  const [month, setMonth] = useState(initialMonth ?? today.getMonth() + 1); // 1-based
  const [activeDiff, setActiveDiff] = useState<Difficulty>(initialDiff ?? "easy");
  const [days, setDays] = useState<DayInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [dayStats, setDayStats] = useState<DayStatsData | null>(null);
  const [dayStatsDate, setDayStatsDate] = useState<string | null>(null);
  const [dayStatsLoading, setDayStatsLoading] = useState(false);
  const [monthLeaderboard, setMonthLeaderboard] = useState<Record<string, { rank: number; displayName: string; gold: number; isMe: boolean }[]> | null>(null);
  const [monthLeaderboardLoading, setMonthLeaderboardLoading] = useState(false);
  const [showMonthLeaderboard, setShowMonthLeaderboard] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleClose = () => {
    setDayStats(null);
    setDayStatsDate(null);
    setDayStatsLoading(false);
    setShowMonthLeaderboard(false);
    setMonthLeaderboard(null);
    onClose();
  };

  const fetchMonthLeaderboard = async (y: number, m: number) => {
    setDayStats(null);
    setDayStatsDate(null);
    setShowMonthLeaderboard(true);
    setMonthLeaderboard(null);
    setMonthLeaderboardLoading(true);
    try {
      const res = await fetch(`/api/picross/leaderboard?year=${y}&month=${m}`);
      if (res.ok) setMonthLeaderboard(await res.json());
    } catch {}
    finally { setMonthLeaderboardLoading(false); }
  };

  const loadMonth = useCallback(async (y: number, m: number) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/picross/calendar?year=${y}&month=${m}`, { signal });
      if (res.ok) {
        const data = await res.json();
        setDays(data.days ?? []);
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadMonth(year, month);
  }, [open, year, month, loadMonth]);

  // Sync initial props when reopened at a specific month (e.g. returning from a past puzzle)
  useEffect(() => {
    if (initialYear) setYear(initialYear);
    if (initialMonth) setMonth(initialMonth);
    if (initialDiff) setActiveDiff(initialDiff);
  }, [initialYear, initialMonth, initialDiff]);

  if (!open) return null;

  const isPrevDisabled = year === 2026 && month <= 4;
  const isNextDisabled =
    year > today.getFullYear() ||
    (year === today.getFullYear() && month >= today.getMonth() + 1);

  const resetPanels = () => { setDayStats(null); setDayStatsDate(null); setShowMonthLeaderboard(false); setMonthLeaderboard(null); };
  const prevMonth = () => {
    if (isPrevDisabled) return;
    resetPanels();
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (isNextDisabled) return;
    resetPanels();
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  };

  // For the current month, fill in all days (placeholder DayInfo for days without puzzles)
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayMap = new Map(days.map(d => [d.date, d]));
  const allDays: DayInfo[] = isCurrentMonth
    ? Array.from({ length: daysInMonth }, (_, i) => {
        const dayNum = i + 1;
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        return dayMap.get(dateStr) ?? { date: dateStr, puzzleExists: false, easy: 'not-started' as Status, medium: 'not-started' as Status, hard: 'not-started' as Status };
      })
    : days;

  const firstDayOfWeek = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const cells: (DayInfo | null)[] = [...Array(firstDayOfWeek).fill(null), ...allDays];

  const diffBtnStyle = (d: Difficulty): React.CSSProperties => ({
    fontFamily: COURIER_FONT,
    fontWeight: 700,
    fontSize: 13,
    padding: "5px 14px",
    borderRadius: 6,
    cursor: "pointer",
    border: "2px solid #7c3aed",
    textTransform: "uppercase",
    background: activeDiff === d ? "#7c3aed" : "#fff",
    color: activeDiff === d ? "#fff" : "#7c3aed",
    transition: "background 0.15s, color 0.15s",
  });

  return (
    <div
      onClick={handleClose}
      style={{
        position: "fixed", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.45)", zIndex: 2000,
      }}
    >
      <style>{`@keyframes pp-spin { to { transform: rotate(360deg); } }`}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 12,
          padding: "20px 20px 16px",
          width: "min(560px, 95vw)",
          height: "min(700px, 92vh)",
          fontFamily: COURIER_FONT, color: "#111",
          boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Title + month navigation */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexShrink: 0 }}>
          <button
            onClick={prevMonth}
            disabled={isPrevDisabled}
            style={{ background: "transparent", border: "none", fontSize: 28, fontWeight: 800, cursor: isPrevDisabled ? "default" : "pointer", color: "#7c3aed", lineHeight: 1, padding: "0 8px", opacity: isPrevDisabled ? 0.3 : 1 }}
          >
            ‹
          </button>
          <span style={{ fontWeight: 800, fontSize: 18 }}>
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            disabled={isNextDisabled}
            style={{ background: "transparent", border: "none", fontSize: 28, fontWeight: 800, cursor: isNextDisabled ? "default" : "pointer", color: "#7c3aed", lineHeight: 1, padding: "0 8px", opacity: isNextDisabled ? 0.3 : 1 }}
          >
            ›
          </button>
        </div>

        {/* Difficulty tabs + monthly leaderboard button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
              <button key={d} onClick={() => { setActiveDiff(d); setDayStats(null); setDayStatsDate(null); setDayStatsLoading(false); }} style={diffBtnStyle(d)}>
                {d}
              </button>
            ))}
          </div>
          <button
            onClick={() => showMonthLeaderboard ? setShowMonthLeaderboard(false) : fetchMonthLeaderboard(year, month)}
            title={`Top solvers — ${MONTH_NAMES[month - 1]} ${year}`}
            style={{ background: showMonthLeaderboard ? "#7c3aed" : "#fff", border: "2px solid #7c3aed", borderRadius: 6, padding: "4px 8px", cursor: "pointer", display: "flex", alignItems: "center", transition: "background 0.15s" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill={showMonthLeaderboard ? "#fff" : "#7c3aed"}>
              <rect x="1" y="11" width="4" height="8" rx="1"/>
              <rect x="7.5" y="6" width="4" height="13" rx="1"/>
              <rect x="14" y="1" width="4" height="18" rx="1"/>
            </svg>
          </button>
        </div>

        {/* Day-of-week headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 3, flexShrink: 0 }}>
          {DAY_NAMES.map((d) => (
            <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#aaa", padding: "2px 0", fontFamily: COURIER_FONT }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar area — fills remaining space, scrolls if needed */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                border: "4px solid #e5e7eb",
                borderTopColor: "#7c3aed",
                animation: "pp-spin 0.8s linear infinite",
              }} />
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
              {cells.map((day, i) => {
                if (!day) return <div key={`e-${i}`} />;

                const isToday = day.date === todayStr;
                const isFuture = day.date > todayStr;
                const dayNum = parseInt(day.date.slice(8), 10);
                const isHardLocked = !isAdmin && activeDiff === 'hard' && day.date < HARD_LAUNCH_DATE;
                const exists = isHardLocked ? false : day.puzzleExists;
                const status: Status = isHardLocked ? 'not-started' : day[activeDiff];
                const celebrate = status === "complete";

                const grid: boolean[][] | null | undefined = isHardLocked ? undefined :
                  activeDiff === "easy" ? day.easyGrid :
                  activeDiff === "medium" ? day.mediumGrid :
                  day.hardGrid;
                const progress: CellState[][] | null | undefined = isHardLocked ? undefined :
                  activeDiff === "easy" ? day.easyProgress :
                  activeDiff === "medium" ? day.mediumProgress :
                  day.hardProgress;

                let borderColor = "#e5e7eb";
                let borderWidth = 1;
                if (isToday) { borderColor = "#7c3aed"; borderWidth = 2; }
                else if (status === "complete") { borderColor = "#d4af37"; borderWidth = 2; }
                else if (status === "in-progress") { borderColor = "#d97706"; borderWidth = 2; }

                const medal = day.medals?.[activeDiff] ?? null;
                const isPast = day.date < todayStr && exists;

                return (
                  <div
                    key={day.date}
                    style={{
                      position: "relative",
                      borderRadius: 6,
                      border: `${borderWidth}px solid ${borderColor}`,
                      background: "#fff",
                      opacity: isFuture ? 0.3 : (exists ? 1 : 0.2),
                    }}
                  >
                    {/* Clickable puzzle area */}
                    <div
                      role="button"
                      tabIndex={exists && grid && day.date <= todayStr ? 0 : -1}
                      onClick={() => exists && grid && day.date <= todayStr && onSelectPuzzle(day.date, activeDiff)}
                      title={exists ? `${day.date} · ${activeDiff} · ${status}` : undefined}
                      style={{
                        cursor: exists && grid && day.date <= todayStr ? "pointer" : "default",
                        display: "flex", flexDirection: "column",
                        alignItems: "center",
                        padding: "4px 4px 2px",
                        gap: 2,
                        opacity: 1,
                      }}
                    >
                      {/* Top row: date number + medal + stats icon */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", minHeight: 14 }}>
                        <span style={{ fontSize: 11, fontWeight: isToday ? 800 : 500, color: isToday ? "#7c3aed" : "#888", lineHeight: 1 }}>
                          {dayNum}
                        </span>
                        <span style={{ fontSize: 11, lineHeight: 1, opacity: medal ? 1 : 0.25, visibility: (medal || (isAdmin && status === "complete")) ? "visible" : "hidden" }}>
                          <MedalIcon type={medal === "silver" ? "silver" : "gold"} size={12} />
                        </span>
                        {isPast && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              setDayStats(null);
                              setDayStatsDate(day.date);
                              setShowMonthLeaderboard(false);
                              setDayStatsLoading(true);
                              try {
                                const res = await fetch(`/api/picross/day-stats?date=${day.date}`);
                                if (res.ok) setDayStats(await res.json());
                              } catch {}
                              finally { setDayStatsLoading(false); }
                            }}
                            title={`Stats for ${day.date}`}
                            style={{
                              background: "none", border: "none", padding: 0,
                              cursor: "pointer", display: "flex", alignItems: "center",
                              opacity: dayStatsDate === day.date ? 1 : 0.5, lineHeight: 1,
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 20 20" fill="#7c3aed">
                              <rect x="1" y="11" width="4" height="8" rx="1"/>
                              <rect x="7.5" y="6" width="4" height="13" rx="1"/>
                              <rect x="14" y="1" width="4" height="18" rx="1"/>
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Puzzle icon */}
                      <div style={{ width: "100%" }}>
                        <DifficultyIcon
                          grid={grid ?? emptyGrids[activeDiff]}
                          progress={progress ?? undefined}
                          celebrate={celebrate}
                        />
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Monthly leaderboard panel */}
        {showMonthLeaderboard && (
          <div style={{ marginTop: 10, flexShrink: 0, borderRadius: 8, overflow: "hidden", border: "1px solid #e5d8ff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "#f9f5ff" }}>
              <span style={{ fontFamily: COURIER_FONT, fontWeight: 700, fontSize: 11, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {MONTH_NAMES[month - 1]} {year} — {activeDiff.toUpperCase()} leaders
              </span>
              <button onClick={() => setShowMonthLeaderboard(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 14, lineHeight: 1, padding: 0 }}>✕</button>
            </div>
            <div style={{ background: "#2c2c2c", padding: "10px 12px" }}>
              {monthLeaderboardLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 60 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", border: "3px solid rgba(204,163,255,0.2)", borderTopColor: "#cca3ff", animation: "pp-spin 0.8s linear infinite" }} />
                </div>
              ) : (() => {
                const entries = monthLeaderboard?.[activeDiff] ?? [];
                if (entries.length === 0) return <div style={{ color: "#888", fontSize: 12, fontFamily: COURIER_FONT }}>No data yet.</div>;
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {entries.map(e => (
                      <div key={e.rank} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: COURIER_FONT, fontSize: 13 }}>
                        <span style={{ color: "#888", width: 16, textAlign: "right", flexShrink: 0 }}>#{e.rank}</span>
                        <span style={{ color: e.isMe ? "#cca3ff" : "#fff", fontWeight: e.isMe ? 700 : 400, flex: 1 }}>{e.displayName}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#D4AF37", flexShrink: 0 }}>
                          <MedalIcon type="gold" size={13} /> {e.gold}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Day stats panel */}
        {!showMonthLeaderboard && (dayStats || dayStatsLoading) && (
          <div style={{ marginTop: 10, flexShrink: 0, borderRadius: 8, overflow: "hidden", border: "1px solid #e5d8ff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "#f9f5ff" }}>
              <span style={{ fontFamily: COURIER_FONT, fontWeight: 700, fontSize: 11, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {dayStats ? (() => { const [y,m,d] = dayStats.date.split('-').map(Number); return `${MONTH_NAMES[m-1]} ${d}, ${y} — ${activeDiff.toUpperCase()}`; })() : ""}
              </span>
              <button onClick={() => { setDayStats(null); setDayStatsDate(null); setDayStatsLoading(false); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 14, lineHeight: 1, padding: 0 }}>✕</button>
            </div>
            <div style={{ background: "#2c2c2c", padding: "10px 12px", minHeight: 170, display: "flex", flexDirection: "column" }}>
              <div style={{ flex: 1 }}>
                {dayStatsLoading ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 150 }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", border: "3px solid rgba(204,163,255,0.2)", borderTopColor: "#cca3ff", animation: "pp-spin 0.8s linear infinite" }} />
                  </div>
                ) : dayStats && (() => {
                  const s = dayStats[activeDiff];
                  return (
                    <>
                      {isAdmin && (
                        <div style={{ fontSize: 11, color: "#cca3ff", marginBottom: 8, fontFamily: COURIER_FONT }}>
                          {s.count} solver{s.count !== 1 ? "s" : ""}
                        </div>
                      )}
                      <SolveHistogram key={`${dayStats.date}-${activeDiff}`} times={s.times} myTime={s.myTime} avg={s.avg} hideBottomRow />
                    </>
                  );
                })()}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: 11, fontFamily: COURIER_FONT }}>
                <span style={{ color: "#cca3ff", display: 'flex', alignItems: 'center', gap: 4 }}><MedalIcon type="gold" size={14} /> {dayStats ? fmtTime(dayStats[activeDiff].fastest) : "—"}</span>
                <span style={{ color: "#f9c74f" }}>{dayStats?.[activeDiff]?.myTime != null ? `▼ Your time: ${fmtTime(dayStats[activeDiff].myTime)}` : ""}</span>
                <span style={{ color: "#aaa" }}>Average:  {dayStats ? fmtTime(dayStats[activeDiff].avg) : "—"}</span>
              </div>
            </div>
          </div>
        )}

        {/* Close */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12, flexShrink: 0 }}>
          <button
            onClick={handleClose}
            style={{ fontFamily: COURIER_FONT, fontWeight: 700, fontSize: 14, padding: "8px 20px", borderRadius: 8, border: "1px solid #ccc", background: "#fff", cursor: "pointer", color: "#333" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
