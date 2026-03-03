"use client";

import React, { useState, useEffect, useContext } from "react";
import { DarkModeContext } from "../layout";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function generateCalendar(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay(); // 0=Sun..6=Sat

  const weeks: Array<(number | null)[]> = [];
  let currentDay = 1 - startWeekday;

  while (currentDay <= daysInMonth) {
    const week: (number | null)[] = [];
    for (let i = 0; i < 7; i++) {
      if (currentDay > 0 && currentDay <= daysInMonth) {
        week.push(currentDay);
      } else {
        week.push(null);
      }
      currentDay++;
    }
    weeks.push(week);
  }
  return weeks;
}

export default function DailyNotesHome() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [showDropdown, setShowDropdown] = useState(false);
  const [notes, setNotes] = useState<Record<string, { title: string; body: string }>>({});
  // dark mode comes from context shared in root layout
  const { isDarkMode, toggle } = useContext(DarkModeContext);

  // read query param "ym" like "2026-03"
  useEffect(() => {
    const param = searchParams.get("ym");
    if (param) {
      const [y, m] = param.split("-").map(Number);
      if (!isNaN(y) && !isNaN(m)) {
        setYear(y);
        setMonth(m - 1);
      }
    }
  }, [searchParams]);


  // load notes for the visible month from localStorage
  useEffect(() => {
    const loaded: Record<string, { title: string; body: string }> = {};
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const raw = localStorage.getItem(`note-${dateStr}`);
      if (raw) {
        try {
          loaded[dateStr] = JSON.parse(raw);
        } catch (e) {
          // ignore parse errors
        }
      }
    }
    setNotes(loaded);
  }, [year, month]);

  const weeks = generateCalendar(year, month);
  const monthName = new Date(year, month).toLocaleString("default", { month: "long" });

  function changeMonth(delta: number) {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    setYear(newYear);
    setMonth(newMonth);
    router.push(`/daily-notes?ym=${newYear}-${String(newMonth + 1).padStart(2, "0")}`);
  }

  function handleYearChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newYear = Number(e.target.value);
    setYear(newYear);
    router.push(`/daily-notes?ym=${newYear}-${String(month + 1).padStart(2, "0")}`);
  }

  function handleMonthChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newMonth = Number(e.target.value);
    setMonth(newMonth);
    router.push(`/daily-notes?ym=${year}-${String(newMonth + 1).padStart(2, "0")}`);
  }

  const yearOptions = Array.from({ length: 10 }, (_, i) => year - 5 + i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i);

  const bgColor = isDarkMode ? "#1a1a1a" : "#fff";
  const textColor = isDarkMode ? "#e5e5e5" : "#000";
  const borderColor = isDarkMode ? "#444" : "#ccc";
  const headerBgColor = isDarkMode ? "#262626" : "#f9fafb";
  const cellBgColor = isDarkMode ? "#1f1f1f" : "#fff";

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: 24, fontFamily: "system-ui, sans-serif", background: bgColor, color: textColor, transition: "background-color 0.2s, color 0.2s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 800, marginBottom: 24, width: "100%" }}>
        <div
          role="button"
          onClick={() => {
            const today = new Date();
            const y = today.getFullYear();
            const m = today.getMonth();
            setYear(y);
            setMonth(m);
            router.push(`/daily-notes?ym=${y}-${String(m + 1).padStart(2, "0")}`);
          }}
          style={{ fontSize: 18, fontWeight: 600, cursor: "pointer" }}
        >
          {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </div>
        <button
          onClick={toggle}
          style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${borderColor}`, background: cellBgColor, color: textColor, cursor: "pointer" }}
        >
          {isDarkMode ? "☀️" : "🌙"}
        </button>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 600, position: "relative", width: "100%", color: textColor }}>
        <button onClick={() => changeMonth(-1)} style={{ background: cellBgColor, color: textColor, border: `1px solid ${borderColor}` }}>←</button>
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: 0, cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 8, color: textColor }} onClick={() => setShowDropdown(!showDropdown)}>
            {monthName} {year}
            <span style={{ fontSize: "0.8em", transitionDuration: "0.2s", transform: showDropdown ? "rotate(180deg)" : "rotate(0deg)", display: "flex" }}>▼</span>
          </h1>
          {showDropdown && (
            <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", background: cellBgColor, border: `1px solid ${borderColor}`, borderRadius: 4, padding: 12, marginTop: 8, zIndex: 100, boxShadow: isDarkMode ? "0 4px 6px rgba(0,0,0,0.5)" : "0 4px 6px rgba(0,0,0,0.1)", minWidth: 200 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <select value={year} onChange={handleYearChange} style={{ flex: 1, padding: 4, background: headerBgColor, color: textColor, border: `1px solid ${borderColor}` }}>
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={month} onChange={handleMonthChange} style={{ flex: 1, padding: 4, background: headerBgColor, color: textColor, border: `1px solid ${borderColor}` }}>
                  {monthOptions.map(m => (
                    <option key={m} value={m}>
                      {new Date(year, m).toLocaleString("default", { month: "short" })}
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={() => setShowDropdown(false)} style={{ width: "100%", padding: 6, background: headerBgColor, color: textColor, border: `1px solid ${borderColor}` }}>Close</button>
            </div>
          )}
        </div>
        <button onClick={() => changeMonth(1)} style={{ background: cellBgColor, color: textColor, border: `1px solid ${borderColor}` }}>→</button>
      </div>
      <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 600, marginTop: 16, border: `1px solid ${borderColor}`, tableLayout: "fixed", background: cellBgColor }}>
        <thead>
          <tr>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <th key={d} style={{ padding: 8, border: `1px solid ${borderColor}`, backgroundColor: headerBgColor, color: textColor }}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((day, di) => {
                const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const isToday = day === now.getDate() && year === now.getFullYear() && month === now.getMonth();
                return (
                  <td key={di} style={{height: 90, border: `1px solid ${borderColor}`, textAlign: "left", verticalAlign: "top", padding: "3px 6px 6px 6px", boxSizing: "border-box", overflow: "hidden", position: "relative", background: cellBgColor, color: textColor }}>
                    {day ? (
                      <Link href={`/daily-notes/${dateStr}`} style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}>
                        <div style={{ marginBottom: 2 }}>
                          {isToday ? (
                            <span style={{ display: "inline-flex", width: 20, height: 20, borderRadius: 10, background: textColor, color: bgColor, alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{day}</span>
                          ) : (
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{day}</span>
                          )}
                        </div>
                        {notes[dateStr] && notes[dateStr].body && (
                          <>
                            <div style={{ marginTop: 1, fontSize: 6, color: isDarkMode ? "#999" : "#374151", whiteSpace: "pre-wrap", wordBreak: "break-word", overflow: "hidden", maxHeight: "58px", lineHeight: 1.1 }}>
                              {(() => {
                                const body = notes[dateStr].body;
                                const lines = body.split('\n');
                                const isTooLong = body.length > 120 || lines.length > 3;
                                if (isTooLong) {
                                  const truncated = lines.slice(0, 3).join('\n').substring(0, 120);
                                  return `${truncated}...`;
                                }
                                return body;
                              })()}
                            </div>
                            <div style={{ position: "absolute", bottom: 0, left: 0, width: 0, height: 0, borderRight: "12px solid transparent", borderBottom: `12px solid ${textColor}` }}></div>
                          </>
                        )}
                      </Link>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}