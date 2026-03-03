"use client";

import React, { useState, useEffect, useContext } from "react";
import { DarkModeContext } from "../../layout";
import Link from "next/link";

export default function DayNotesPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = React.use(params);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const { isDarkMode, toggle } = useContext(DarkModeContext);


  // Load notes from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(`note-${date}`);
    if (stored) {
      const { title: savedTitle, body: savedBody } = JSON.parse(stored);
      setTitle(savedTitle || "");
      setBody(savedBody || "");
    }
    setIsLoaded(true);
  }, [date]);

  // Save notes to localStorage whenever title or body changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(`note-${date}`, JSON.stringify({ title, body }));
    }
  }, [title, body, date, isLoaded]);

  const bgColor = isDarkMode ? "#1a1a1a" : "#fff";
  const textColor = isDarkMode ? "#e5e5e5" : "#000";
  const borderColor = isDarkMode ? "#444" : "#d1d5db";
  const cellBgColor = isDarkMode ? "#1f1f1f" : "#fff";

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif",  margin: "0 auto", background: bgColor, color: textColor, minHeight: "100vh", transition: "background-color 0.2s, color 0.2s" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Link href="/daily-notes" style={{ color: textColor, textDecoration: "underline" }}>← Back to Calendar</Link>
            <button
            onClick={toggle}
            style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${borderColor}`, background: cellBgColor, color: textColor, cursor: "pointer" }}
            >
            {isDarkMode ? "☀️" : "🌙"}
            </button>
        </div>

        <div style={{ marginBottom: 24 }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{date}</p>
        </div>

        <div>
            <textarea
            placeholder="Write your notes here..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            style={{
                width: "100%",
                minHeight: 300,
                padding: 12,
                border: `1px solid ${borderColor}`,
                borderRadius: 6,
                fontSize: 16,
                fontFamily: "system-ui, sans-serif",
                resize: "vertical",
                boxSizing: "border-box",
                background: cellBgColor,
                color: textColor
            }}
            />
        </div>
      </div>
      
    </main>
  );
}
