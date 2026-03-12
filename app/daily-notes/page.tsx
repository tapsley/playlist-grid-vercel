"use client";

import React, { useState, useEffect, useContext, Suspense, useRef } from "react";
import { DarkModeContext } from "../layout";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import SignOutButton from "@/app/daily-notes/components/SignOutButton";
import { clearNotesCache, getCachedMonthNotes, setCachedMonthNotes } from "@/lib/notesCache";

type MonthNotesMap = Record<string, { title: string; body: string }>;

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

function toYm(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function CalendarContent({ isAuthenticated }: { isAuthenticated: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();


  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [showDropdown, setShowDropdown] = useState(false);
  const [notes, setNotes] = useState<Record<string, { title: string; body: string }>>({});
  const [isMonthLoading, setIsMonthLoading] = useState(false);
  const prefetchInFlightRef = useRef<Set<string>>(new Set());
  const activeLoadIdRef = useRef(0);
  // dark mode comes from context shared in root layout
  const { isDarkMode, toggle } = useContext(DarkModeContext);

  useEffect(() => {
    const ym = searchParams.get("ym");
    if (!ym) return;
    const match = /^(\d{4})-(\d{2})$/.exec(ym);
    if (!match) return;

    const nextYear = Number(match[1]);
    const nextMonth = Number(match[2]) - 1;
    if (nextMonth < 0 || nextMonth > 11) return;

    setYear((prev) => (prev === nextYear ? prev : nextYear));
    setMonth((prev) => (prev === nextMonth ? prev : nextMonth));
  }, [searchParams]);

  // load notes for the visible month from the API
  useEffect(() => {
    if (!isAuthenticated) {
      setNotes({});
      setIsMonthLoading(false);
      clearNotesCache();
      prefetchInFlightRef.current.clear();
      return;
    }

    const controller = new AbortController();
    const ym = toYm(year, month);
    const loadId = ++activeLoadIdRef.current;
    const cached = getCachedMonthNotes(ym);
    if (cached) {
      setNotes(cached);
      setIsMonthLoading(false);
    } else {
      setIsMonthLoading(true);
    }

    async function fetchMonth(targetYm: string, updateUi: boolean, signal?: AbortSignal) {
      const res = await fetch(`/api/notes?ym=${targetYm}`, {
        method: "GET",
        credentials: "same-origin",
        signal,
      });
      if (!res.ok) {
        if (updateUi && !getCachedMonthNotes(targetYm)) setNotes({});
        return;
      }
      const data: Array<{ id: string; date: string; title?: string; body?: string }> = await res.json();
      const loaded: MonthNotesMap = {};
      data.forEach((n) => {
        loaded[n.date] = { title: n.title ?? "", body: n.body ?? "" };
      });
      setCachedMonthNotes(loaded);
      if (updateUi) {
        setNotes(loaded);
      }
    }

    function prefetchMonth(targetYear: number, targetMonth: number) {
      const targetYm = toYm(targetYear, targetMonth);
      if (getCachedMonthNotes(targetYm) || prefetchInFlightRef.current.has(targetYm)) return;

      prefetchInFlightRef.current.add(targetYm);
      fetchMonth(targetYm, false)
        .catch(() => {
          // ignore prefetch errors
        })
        .finally(() => {
          prefetchInFlightRef.current.delete(targetYm);
        });
    }

    async function loadMonthNotes() {
      try {
        await fetchMonth(ym, true, controller.signal);

        const prevMonthDate = new Date(year, month - 1, 1);
        const nextMonthDate = new Date(year, month + 1, 1);
        prefetchMonth(prevMonthDate.getFullYear(), prevMonthDate.getMonth());
        prefetchMonth(nextMonthDate.getFullYear(), nextMonthDate.getMonth());
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        if (!getCachedMonthNotes(ym)) setNotes({});
      } finally {
        if (activeLoadIdRef.current === loadId) {
          setIsMonthLoading(false);
        }
      }
    }
    loadMonthNotes();

    return () => {
      controller.abort();
    };
  }, [year, month, isAuthenticated]);

  const weeks = generateCalendar(year, month);
  const monthName = new Date(year, month).toLocaleString("default", { month: "long" });

  function setCalendarMonth(nextYear: number, nextMonth: number) {
    setYear(nextYear);
    setMonth(nextMonth);
    router.replace(`/daily-notes?ym=${nextYear}-${String(nextMonth + 1).padStart(2, "0")}`, { scroll: false });
  }

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
    setCalendarMonth(newYear, newMonth);
  }

  function handleYearChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newYear = Number(e.target.value);
    setCalendarMonth(newYear, month);
  }

  function handleMonthChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newMonth = Number(e.target.value);
    setCalendarMonth(year, newMonth);
  }

  const yearOptions = Array.from({ length: 10 }, (_, i) => year - 5 + i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i);
  const currentYm = toYm(year, month);

  const bgColor = isDarkMode ? "#1a1a1a" : "#fff";
  const textColor = isDarkMode ? "#e5e5e5" : "#000";
  const borderColor = isDarkMode ? "#444" : "#ccc";
  const headerBgColor = isDarkMode ? "#262626" : "#f9fafb";
  const cellBgColor = isDarkMode ? "#1f1f1f" : "#fff";

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: 24, fontFamily: "system-ui, sans-serif", background: bgColor, color: textColor, transition: "background-color 0.2s, color 0.2s", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 800, marginBottom: 24, width: "100%" }}>
        <div
          role="button"
          onClick={() => {
            const today = new Date();
            const y = today.getFullYear();
            const m = today.getMonth();
            setCalendarMonth(y, m);
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
        <button onClick={() => changeMonth(-1)} style={{ background: cellBgColor, cursor: "pointer", color: textColor }}>◀</button>
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
        <button onClick={() => changeMonth(1)} style={{ background: cellBgColor, cursor: "pointer", color: textColor }}>▶</button>
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
                      <Link href={`/daily-notes/${dateStr}?ym=${currentYm}`} style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}>
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
      {isMonthLoading && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isDarkMode ? "rgba(0,0,0,0.28)" : "rgba(255,255,255,0.32)", pointerEvents: "none", zIndex: 20 }}>
          <div className="animate-spin" style={{ width: 36, height: 36, borderRadius: "50%", border: `4px solid ${isDarkMode ? "#4b5563" : "#d1d5db"}`, borderTopColor: isDarkMode ? "#598eff" : "#db2777" }} />
        </div>
      )}
      {isAuthenticated && <SignOutButton />}
    </main>
  );
}

// the default export wraps the calendar content with authentication and suspense
export default function Page() {
  const { data: session, status } = useSession();
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAuthSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    if (authMode === "signup") {
      const signupRes = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const signupBody = await signupRes.json().catch(() => ({}));
      if (!signupRes.ok) {
        setIsSubmitting(false);
        setError(signupBody.error || "Could not create account");
        return;
      }
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setIsSubmitting(false);

    if (!result || result.error) {
      setError(authMode === "signup" ? "Account created, but sign-in failed" : "Invalid email or password");
      return;
    }

    setEmail("");
    setPassword("");
  }

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Suspense fallback={<div>Loading calendar...</div>}>
        <CalendarContent isAuthenticated={!!session} />
      </Suspense>

      {!session && (
        <div style={{ position: "fixed", inset: 0, zIndex: 40, display: "grid", placeItems: "center", padding: 24, background: "rgba(0,0,0,0.45)" }}>
          <div style={{ width: "100%", maxWidth: 420, borderRadius: 12, border: "1px solid #374151", background: "#1f2937", padding: 20, color: "#e5e7eb" }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Daily Notes</h1>
            <p style={{ marginTop: 8, marginBottom: 16, color: "#9ca3af" }}>
              {authMode === "signin" ? "Sign in to continue." : "Create an account to continue."}
            </p>

            <form onSubmit={handleAuthSubmit} style={{ display: "grid", gap: 10 }}>
              <input
                type="text"
                placeholder="Username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #4b5563", background: "#111827", color: "#e5e7eb" }}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #4b5563", background: "#111827", color: "#e5e7eb" }}
              />
              {error && <p style={{ margin: 0, color: "#fca5a5", fontSize: 14 }}>{error}</p>}
              <button
                type="submit"
                disabled={isSubmitting}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "none", background: "#598eff", color: "white", fontWeight: 600, cursor: isSubmitting ? "not-allowed" : "pointer", opacity: isSubmitting ? 0.7 : 1 }}
              >
                {isSubmitting ? (authMode === "signin" ? "Signing in..." : "Creating account...") : authMode === "signin" ? "Sign In" : "Sign Up"}
              </button>
            </form>

            <p style={{ marginTop: 12, marginBottom: 0, fontSize: 14, color: "#9ca3af" }}>
              {authMode === "signin" ? "Need an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => {
                  setAuthMode((m) => (m === "signin" ? "signup" : "signin"));
                  setError("");
                }}
                style={{ color: "#598eff", background: "transparent", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}
              >
                {authMode === "signin" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
