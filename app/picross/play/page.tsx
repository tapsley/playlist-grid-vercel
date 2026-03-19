// Moved PicrossPage implementation here from page.tsx
"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import type { PrefetchShape } from "../PicrossPrefetchContext";
import { usePicrossPrefetch } from "../PicrossPrefetchContext";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const DIFFICULTY_CONFIG: Record<string, { size: number }> = {
  easy: { size: 5 },
  medium: { size: 10 },
  hard: { size: 15 },
};

function getDefaultPuzzle(size: number): boolean[][] {
  return Array(size).fill(0).map(() => Array(size).fill(false));
}

type CellState = 0 | 1 | 2;

function getClues(puzzle: boolean[][]) {
  const rows = puzzle.map(row => {
    const clues = [];
    let count = 0;
    for (const cell of row) {
      if (cell) count++;
      else if (count) { clues.push(count); count = 0; }
    }
    if (count) clues.push(count);
    return clues.length ? clues : [0];
  });
  const cols = [];
  for (let c = 0; c < puzzle[0].length; c++) {
    const clues = [] as number[];
    let count = 0;
    for (let r = 0; r < puzzle.length; r++) {
      if (puzzle[r][c]) count++;
      else if (count) { clues.push(count); count = 0; }
    }
    if (count) clues.push(count);
    cols.push(clues.length ? clues : [0]);
  }
  return { rows, cols };
}

function PicrossPlayInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const difficulty = searchParams.get("difficulty") || "easy";
  const size = DIFFICULTY_CONFIG[difficulty]?.size || 5;
  const { puzzle: prefetchPuzzle, progress: prefetchProgress, setPrefetch } = usePicrossPrefetch() as PrefetchShape;
  // Editor-only local puzzle state; main puzzle/progress live in provider
  const [editorMode, setEditorMode] = useState(false);
  const [editorPuzzle, setEditorPuzzle] = useState<boolean[][] | null>(null);
  const findNextAbort = useRef<AbortController | null>(null);

  const puzzle = editorMode
    ? (editorPuzzle ?? (prefetchPuzzle && prefetchPuzzle[difficulty]) ?? getDefaultPuzzle(size))
    : (prefetchPuzzle && prefetchPuzzle[difficulty]) ?? getDefaultPuzzle(size);

  const { rows: rowClues, cols: colClues } = useMemo(() => getClues(puzzle), [puzzle]);

  const { data: session } = useSession();

  const isPuzzleEmpty = (p: unknown): boolean => {
    if (!Array.isArray(p)) return true;
    try {
      for (const row of p as unknown[]) {
        if (Array.isArray(row)) {
          for (const cell of row) {
            if (cell) return false;
          }
        }
      }
    } catch {
      return true;
    }
    return true;
  };

  const baseBtnStyle: React.CSSProperties = { padding: '6px 10px', fontSize: 14, borderRadius: 6, border: '1px solid #aaa', background: '#f8f8f8', cursor: 'pointer' };
  const primaryBtnStyle: React.CSSProperties = { ...baseBtnStyle, background: '#2b6cb0', color: '#fff', border: '1px solid #2b6cb0' };
  const dangerBtnStyle: React.CSSProperties = { ...baseBtnStyle, background: '#fff', color: '#c53030', border: '1px solid #c53030' };

  // Get today's date in YYYY-MM-DD
  const dateStr = new Date().toISOString().slice(0, 10);

  // Use email as identifier for session
  const userIsLoggedIn = !!session?.user?.email;

  const grid: CellState[][] = useMemo(() => {
    if (prefetchProgress && prefetchProgress[difficulty]) {
      return prefetchProgress[difficulty].map((row: number[]) => row.map(n => n as CellState));
    }
    // if not logged in, check localStorage for saved progress for today's date
    if (!userIsLoggedIn) {
      try {
        const key = `picross:progress:${dateStr}:${difficulty}`;
        const raw = window.localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as { grid?: number[][] } | null;
          if (parsed?.grid && Array.isArray(parsed.grid)) {
            return (parsed.grid as number[][]).map(row => row.map(n => n as CellState));
          }
        }
      } catch (err) {
        console.debug('localStorage read error', err);
      }
    }
    return Array(size).fill(0).map(() => Array(size).fill(0) as CellState[]);
  }, [prefetchProgress, difficulty, size, dateStr, userIsLoggedIn]);

  const cleared = useMemo(() => {
    if (editorMode) return false;
    let win = true;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (puzzle[r][c] && grid[r][c] !== 1) win = false;
        if (!puzzle[r][c] && grid[r][c] === 1) win = false;
      }
    }
    return win;
  }, [grid, puzzle, size, editorMode]);
  const [saveDate, setSaveDate] = useState("");

  const handleCellClick = (r: number, c: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (editorMode) {
      // initialize editorPuzzle from provider if needed
      setEditorPuzzle(prev => {
        const base = prev ?? ((prefetchPuzzle && prefetchPuzzle[difficulty]) ?? getDefaultPuzzle(size));
        const next = base.map(row => [...row]);
        if (e.button === 0) next[r][c] = !next[r][c];
        return next;
      });
      return;
    }

    const next = grid.map(row => [...row] as CellState[]);
    if (e.button === 0) next[r][c] = ((next[r][c] as number) + 1) % 3 as CellState;
    else if (e.button === 2) next[r][c] = next[r][c] === 2 ? 0 : 2;

    // Optimistically update provider state (single source of truth)
    setPrefetch(prev => ({
      ...prev,
      progress: {
        ...prev.progress,
        [difficulty]: next,
      },
    }));
  };

  const handleSave = () => {
    if (!saveDate || !editorPuzzle) return;
    (async () => {
      try {
        const res = await fetch("/api/picross/puzzle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: saveDate, difficulty, puzzle: editorPuzzle }),
        });
        if (res.ok || res.status === 201 || res.status === 204) {
          // update provider so UI reflects new puzzle immediately
          setPrefetch(prev => ({
            ...prev,
            puzzle: {
              ...prev.puzzle,
              [difficulty]: editorPuzzle,
            },
          }));
          alert(`Saved puzzle for ${saveDate} (${difficulty})`);
        } else {
          const text = await res.text();
          alert(`Save failed: ${res.status} ${text}`);
        }
      } catch (err) {
        console.error(err);
        alert(`Save error`);
      }
    })();
  };

  const handleNextDate = async () => {
    // advance saveDate by one day and load puzzle (or blank) for that date
    const base = saveDate || new Date().toISOString().slice(0, 10);
    const d = new Date(base);
    d.setDate(d.getDate() + 1);
    const ds = d.toISOString().slice(0, 10);
    try {
      const res = await fetch(`/api/picross/puzzle?date=${ds}`);
      if (res.status === 404) {
        setEditorPuzzle(getDefaultPuzzle(size));
      } else if (res.ok) {
        const json = await res.json();
        const entry = json?.[difficulty];
        if (isPuzzleEmpty(entry)) {
          setEditorPuzzle(getDefaultPuzzle(size));
        } else if (Array.isArray(entry)) {
          setEditorPuzzle(entry as boolean[][]);
        } else {
          setEditorPuzzle(getDefaultPuzzle(size));
        }
      } else {
        console.debug('next date load failed', res.status);
        setEditorPuzzle(getDefaultPuzzle(size));
      }
    } catch (err) {
      console.debug('next date fetch error', err);
      setEditorPuzzle(getDefaultPuzzle(size));
    }
    setSaveDate(ds);
  };

  const handlePrevDate = async () => {
    // move saveDate back by one day and load puzzle for that date
    const base = saveDate || new Date().toISOString().slice(0, 10);
    const d = new Date(base);
    d.setDate(d.getDate() - 1);
    const ds = d.toISOString().slice(0, 10);
    try {
      const res = await fetch(`/api/picross/puzzle?date=${ds}`);
      if (res.status === 404) {
        setEditorPuzzle(getDefaultPuzzle(size));
      } else if (res.ok) {
        const json = await res.json();
        const entry = json?.[difficulty];
        if (isPuzzleEmpty(entry)) {
          setEditorPuzzle(getDefaultPuzzle(size));
        } else if (Array.isArray(entry)) {
          setEditorPuzzle(entry as boolean[][]);
        } else {
          setEditorPuzzle(getDefaultPuzzle(size));
        }
      } else {
        console.debug('prev date load failed', res.status);
        setEditorPuzzle(getDefaultPuzzle(size));
      }
    } catch (err) {
      console.debug('prev date fetch error', err);
      setEditorPuzzle(getDefaultPuzzle(size));
    }
    setSaveDate(ds);
  };

  const handleClearEditor = () => {
    setEditorPuzzle(getDefaultPuzzle(size));
  };

  const rawEmail = session?.user?.email ?? "";
  const isEditorAllowed = rawEmail.trim().toLowerCase() === "tyler.apsley@gmail.com";

  useEffect(() => {
    if (!isEditorAllowed) {
      setEditorMode(false);
      setEditorPuzzle(null);
      setSaveDate("");
      if (findNextAbort.current) { try { findNextAbort.current.abort(); } catch {} }
    }
  }, [isEditorAllowed]);

  // No local sync effect needed — provider is the source-of-truth.

  // Save progress when grid changes (not in editor mode)

  // Debounce save effect
  const debounceTimeout = useRef<number | null>(null);
  useEffect(() => {
    if (editorMode) return;
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = window.setTimeout(async () => {
      if (!userIsLoggedIn) {
        // persist to localStorage for anonymous users
        try {
          const key = `picross:progress:${dateStr}:${difficulty}`;
          const payload = { grid, complete: cleared };
          window.localStorage.setItem(key, JSON.stringify(payload));
        } catch (err) {
          console.debug('localStorage write error', err);
        }
        return;
      }
      await fetch("/api/picross/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          [difficulty]: grid,
          [`${difficulty}Complete`]: cleared,
        }),
      });
      // No context update here; context is updated optimistically on click
    }, 400); // 400ms debounce
    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [grid, cleared, difficulty, userIsLoggedIn, editorMode, dateStr]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 32 }}>
      <button
        onClick={() => router.push("/picross")}
        style={{ alignSelf: "flex-start", marginBottom: 16, marginLeft: 8, padding: "4px 12px", fontSize: 16, borderRadius: 6, border: "1px solid #aaa", background: "#f8f8f8", cursor: "pointer" }}
      >
        ← Back
      </button>
      <h2>Daily Picross ({size}x{size})</h2>
      {isEditorAllowed && (
        <div style={{ marginBottom: 12 }}>
          <label>
            <input
              type="checkbox"
              checked={editorMode}
              onChange={e => {
                const checked = e.target.checked;
                setEditorMode(checked);
                if (checked) {
                  setEditorPuzzle((prefetchPuzzle && prefetchPuzzle[difficulty]) ?? getDefaultPuzzle(size));
                  // find soonest free date for this difficulty
                  (async () => {
                    if (findNextAbort.current) {
                      try { findNextAbort.current.abort(); } catch {}
                    }
                    const ac = new AbortController();
                    findNextAbort.current = ac;
                    try {
                      const today = new Date();
                          for (let i = 0; i < 365; i++) {
                            const d = new Date(today);
                            d.setDate(today.getDate() + i);
                            const ds = d.toISOString().slice(0, 10);
                            const res = await fetch(`/api/picross/puzzle?date=${ds}`, { signal: ac.signal });
                            if (res.status === 404) {
                              // empty day found — show a blank editor grid for this difficulty
                              setEditorPuzzle(getDefaultPuzzle(size));
                              setSaveDate(ds);
                              findNextAbort.current = null;
                              return;
                            }
                            if (res.ok) {
                              const json = await res.json();
                              const entry = json?.[difficulty];
                              if (isPuzzleEmpty(entry)) {
                                setEditorPuzzle(getDefaultPuzzle(size));
                                setSaveDate(ds);
                                findNextAbort.current = null;
                                return;
                              }
                            }
                          }
                      // fallback to today if none found
                      setSaveDate(today.toISOString().slice(0, 10));
                    } catch (err) {
                      const maybe = err as { name?: string } | undefined;
                      if (maybe && maybe.name === "AbortError") return;
                      console.debug('findNextFreeDate error', err);
                    } finally {
                      findNextAbort.current = null;
                    }
                  })();
                } else {
                  setEditorPuzzle(null);
                  setSaveDate("");
                  if (findNextAbort.current) { try { findNextAbort.current.abort(); } catch {} }
                }
              }}
            />
            Editor Mode
          </label>
        </div>
      )}
      {editorMode && (
        <div style={{ marginBottom: 16 }}>
          <button onClick={handleClearEditor} style={dangerBtnStyle}>Clear</button>
          <button onClick={handlePrevDate} style={{ ...baseBtnStyle, marginRight: 8 }}>Previous</button>
          <input
            type="date"
            value={saveDate}
            onChange={e => setSaveDate(e.target.value)}
            style={{ marginRight: 8 }}
          />
          <button onClick={handleNextDate} style={{ ...baseBtnStyle, marginRight: 8 }}>Next</button>
          <button onClick={handleSave} disabled={!saveDate} style={{ ...primaryBtnStyle, marginRight: 8 }}>Save Puzzle</button>
        </div>
      )}
      {!editorMode && cleared && <div style={{ color: "green", fontWeight: "bold", margin: 8 }}>Cleared!</div>}
      <div style={{ display: "flex" }}>
        <div style={{ width: 40 }} />
        {colClues.map((clue, i) => (
          <div key={i} style={{ width: 40, textAlign: "center", fontSize: 14, marginBottom: 4 }}>
            {clue.map((n, j) => <div key={j}>{n}</div>)}
          </div>
        ))}
      </div>
      {(editorMode ? puzzle : grid).map((row: (boolean[] | CellState[]), r: number) => (
        <div key={r} style={{ display: "flex" }}>
          <div style={{ width: 40, textAlign: "right", fontSize: 14, marginRight: 4 }}>
            {rowClues[r].map((n: number, j: number) => <span key={j} style={{ marginLeft: 2 }}>{n}</span>)}
          </div>
          {row.map((cell: boolean | CellState, c: number) => (
            <div
              key={c}
              onClick={e => handleCellClick(r, c, e)}
              onContextMenu={e => handleCellClick(r, c, e)}
              style={{
                width: 40, height: 40, border: "1px solid #888", display: "flex", alignItems: "center", justifyContent: "center",
                background: editorMode ? (cell ? "#222" : "#fff") : (cell === 1 ? "#222" : "#fff"),
                cursor: "pointer", fontSize: 24, userSelect: "none"
              }}
            >
              {!editorMode && cell === 2 ? "✕" : ""}
            </div>
          ))}
        </div>
      ))}
      <div style={{ marginTop: 16, fontSize: 12, color: "#888" }}>
        {editorMode
          ? "Click to toggle filled/empty. Set date and save."
          : "Left click: fill → X → empty. Right click: X → empty."}
      </div>
    </div>
  );
}

export default function PicrossPage() {
  return (
    <React.Suspense fallback={<div>Loading Picross...</div>}>
      <PicrossPlayInner />
    </React.Suspense>
  );
}
