"use client";
import React, { useState, useEffect, useCallback } from "react";
import SolveHistogram, { fmtTime } from "./SolveHistogram";
import DifficultyIcon from "./DifficultyIcon";
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
  isAdmin?: boolean;
}

const COURIER_FONT = "var(--font-courier-prime), 'Courier New', monospace";
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
  isAdmin,
}: Props) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [year, setYear] = useState(initialYear ?? today.getFullYear());
  const [month, setMonth] = useState(initialMonth ?? today.getMonth() + 1); // 1-based
  const [activeDiff, setActiveDiff] = useState<Difficulty>("easy");
  const [days, setDays] = useState<DayInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [dayStats, setDayStats] = useState<DayStatsData | null>(null);
  const [dayStatsLoading, setDayStatsLoading] = useState(false);

  const loadMonth = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/picross/calendar?year=${y}&month=${m}`);
      if (res.ok) {
        const data = await res.json();
        setDays(data.days ?? []);
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (open) loadMonth(year, month);
  }, [open, year, month, loadMonth]);

  // Sync initial props when reopened at a specific month (e.g. returning from a past puzzle)
  useEffect(() => {
    if (initialYear) setYear(initialYear);
    if (initialMonth) setMonth(initialMonth);
  }, [initialYear, initialMonth]);

  if (!open) return null;

  const prevMonth = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  };

  const isNextDisabled =
    year > today.getFullYear() ||
    (year === today.getFullYear() && month >= today.getMonth() + 1);

  // Leading empty slots + filled day slots
  const firstDayOfWeek = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const cells: (DayInfo | null)[] = [...Array(firstDayOfWeek).fill(null), ...days];

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
      onClick={onClose}
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
            style={{ background: "transparent", border: "none", fontSize: 28, fontWeight: 800, cursor: "pointer", color: "#7c3aed", lineHeight: 1, padding: "0 8px" }}
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

        {/* Difficulty tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexShrink: 0 }}>
          {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
            <button key={d} onClick={() => { setActiveDiff(d); setDayStats(null); setDayStatsLoading(false); }} style={diffBtnStyle(d)}>
              {d}
            </button>
          ))}
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
                const dayNum = parseInt(day.date.slice(8), 10);
                const exists = day.puzzleExists;
                const status: Status = day[activeDiff];
                const celebrate = status === "complete";

                const grid: boolean[][] | null | undefined =
                  activeDiff === "easy" ? day.easyGrid :
                  activeDiff === "medium" ? day.mediumGrid :
                  day.hardGrid;
                const progress: CellState[][] | null | undefined =
                  activeDiff === "easy" ? day.easyProgress :
                  activeDiff === "medium" ? day.mediumProgress :
                  day.hardProgress;

                let borderColor = "#e5e7eb";
                let borderWidth = 1;
                if (isToday) { borderColor = "#7c3aed"; borderWidth = 2; }
                else if (status === "complete") { borderColor = "#7c3aed"; borderWidth = 2; }
                else if (status === "in-progress") { borderColor = "#d97706"; borderWidth = 2; }

                const medal = day.medals?.[activeDiff] ?? null;
                const isPast = !isToday && exists;

                return (
                  <div
                    key={day.date}
                    style={{
                      position: "relative",
                      borderRadius: 6,
                      border: `${borderWidth}px solid ${borderColor}`,
                      background: "#fff",
                      opacity: exists ? 1 : 0.2,
                    }}
                  >
                    {/* Clickable puzzle area */}
                    <div
                      role="button"
                      tabIndex={exists && grid ? 0 : -1}
                      onClick={() => exists && grid && onSelectPuzzle(day.date, activeDiff)}
                      title={exists ? `${day.date} · ${activeDiff} · ${status}` : undefined}
                      style={{
                        cursor: exists && grid ? "pointer" : "default",
                        display: "flex", flexDirection: "column",
                        alignItems: "center",
                        padding: "4px 4px 2px",
                        gap: 2,
                      }}
                    >
                      {/* Top row: date number + medal + stats icon */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", minHeight: 14 }}>
                        <span style={{ fontSize: 11, fontWeight: isToday ? 800 : 500, color: isToday ? "#7c3aed" : "#888", lineHeight: 1 }}>
                          {dayNum}
                        </span>
                        <span style={{ fontSize: 11, lineHeight: 1, opacity: medal ? 1 : 0.25, visibility: (medal || (isAdmin && status === "complete")) ? "visible" : "hidden" }}>
                          {medal === "silver" ? "🥈" : "🥇"}
                        </span>
                        {isPast && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              setDayStats(null);
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
                              opacity: 0.5, lineHeight: 1,
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
                      {grid ? (
                        <div style={{ width: "100%" }}>
                          <DifficultyIcon grid={grid} progress={progress ?? undefined} celebrate={celebrate} />
                        </div>
                      ) : (
                        <div style={{ width: "100%", aspectRatio: "1", background: "#f3f4f6", borderRadius: 4 }} />
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Day stats panel */}
        {(dayStats || dayStatsLoading) && (
          <div style={{ marginTop: 10, flexShrink: 0, borderRadius: 8, overflow: "hidden", border: "1px solid #e5d8ff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "#f9f5ff" }}>
              <span style={{ fontFamily: COURIER_FONT, fontWeight: 700, fontSize: 11, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {dayStats ? (() => { const [y,m,d] = dayStats.date.split('-').map(Number); return `${MONTH_NAMES[m-1]} ${d}, ${y} — ${activeDiff.toUpperCase()}`; })() : ""}
              </span>
              <button onClick={() => { setDayStats(null); setDayStatsLoading(false); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 14, lineHeight: 1, padding: 0 }}>✕</button>
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
                <span style={{ color: "#cca3ff" }}>🥇 {dayStats ? fmtTime(dayStats[activeDiff].fastest) : "—"}</span>
                <span style={{ color: "#f9c74f" }}>{dayStats?.[activeDiff]?.myTime != null ? `▼ Your time: ${fmtTime(dayStats[activeDiff].myTime)}` : ""}</span>
                <span style={{ color: "#aaa" }}>Average:  {dayStats ? fmtTime(dayStats[activeDiff].avg) : "—"}</span>
              </div>
            </div>
          </div>
        )}

        {/* Close */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12, flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ fontFamily: COURIER_FONT, fontWeight: 700, fontSize: 14, padding: "8px 20px", borderRadius: 8, border: "1px solid #ccc", background: "#fff", cursor: "pointer", color: "#333" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
