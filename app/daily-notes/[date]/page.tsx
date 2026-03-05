"use client";

import React, { useState, useEffect, useContext, useRef } from "react";
import { DarkModeContext } from "../../layout";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCachedNote, setCachedNote } from "@/lib/notesCache";

export default function DayNotesPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = React.use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasLocalEditsRef = useRef(false);
  const { isDarkMode, toggle } = useContext(DarkModeContext);


  // Load notes from localStorage on mount
  useEffect(() => {
    if (!session) {
      setIsLoaded(true);
      return;
    }

    hasLocalEditsRef.current = false;

    const cached = getCachedNote(date);
    if (cached) {
      setTitle(cached.title ?? "");
      setBody(cached.body ?? "");
    }

    let mounted = true;
    async function loadNote() {
      try {
        const res = await fetch(`/api/notes/${date}`, { credentials: "same-origin" });
        if (res.ok) {
          const data = await res.json();
          if (!mounted) return;
          if (!hasLocalEditsRef.current) {
            setTitle(data.title ?? "");
            setBody(data.body ?? "");
          }
          setCachedNote(date, { title: data.title ?? "", body: data.body ?? "" });
        }
      } catch (e) {
        // ignore network errors
      } finally {
        if (mounted) setIsLoaded(true);
      }
    }
    loadNote();
    return () => {
      mounted = false;
    };
  }, [date, session]);

  // Save notes to the API with debounce
  useEffect(() => {
    if (!session || !isLoaded) return;
    const t = setTimeout(async () => {
      try {
        await fetch(`/api/notes/${date}`, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, body }),
        });
        setCachedNote(date, { title, body });
      } catch (e) {
        // ignore
      }
    }, 700);
    return () => clearTimeout(t);
  }, [title, body, date, isLoaded, session]);

  useEffect(() => {
    if (status === "loading" || !session) return;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [session, status, date]);

  async function persistNoteNow() {
    if (!session || !isLoaded) return;
    try {
      await fetch(`/api/notes/${date}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      setCachedNote(date, { title, body });
    } catch {
      // ignore and allow navigation
    }
  }

  async function handleBackToCalendar(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    await persistNoteNow();
    router.push(backHref);
  }

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
    }
  }

  const bgColor = isDarkMode ? "#1a1a1a" : "#fff";
  const textColor = isDarkMode ? "#e5e5e5" : "#000";
  const borderColor = isDarkMode ? "#444" : "#d1d5db";
  const cellBgColor = isDarkMode ? "#1f1f1f" : "#fff";
  const ym = searchParams.get("ym");
  const backHref = ym && /^(\d{4})-(\d{2})$/.test(ym) ? `/daily-notes?ym=${ym}` : "/daily-notes";

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  return (
    <>
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif",  margin: "0 auto", background: bgColor, color: textColor, minHeight: "100vh", transition: "background-color 0.2s, color 0.2s" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href={backHref} onClick={handleBackToCalendar} style={{ color: textColor, textDecoration: "underline" }}>← Back to Calendar</Link>
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
            ref={textareaRef}
            autoFocus={!!session}
            placeholder="Write your notes here..."
            value={body}
            onChange={(e) => {
              hasLocalEditsRef.current = true;
              setBody(e.target.value);
            }}
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
    {!session && (
      <div style={{ position: "fixed", inset: 0, zIndex: 40, display: "grid", placeItems: "center", padding: 24, background: "rgba(0,0,0,0.45)" }}>
        <div style={{ width: "100%", maxWidth: 420, borderRadius: 12, border: "1px solid #374151", background: "#1f2937", padding: 20, color: "#e5e7eb" }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Daily Notes</h1>
          <p style={{ marginTop: 8, marginBottom: 16, color: "#9ca3af" }}>
            {authMode === "signin" ? "Sign in to continue." : "Create an account to continue."}
          </p>

          <form onSubmit={handleAuthSubmit} style={{ display: "grid", gap: 10 }}>
            <input
              type="email"
              placeholder="Email"
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
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "none", background: "#10b981", color: "white", fontWeight: 600, cursor: isSubmitting ? "not-allowed" : "pointer", opacity: isSubmitting ? 0.7 : 1 }}
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
              style={{ color: "#6ee7b7", background: "transparent", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}
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
