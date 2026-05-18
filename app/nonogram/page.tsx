"use client";


import { usePicrossPrefetch } from "./PicrossPrefetchContext";
  

import React, { useState, useEffect, useLayoutEffect, useRef, Suspense } from "react";
import { gsap } from 'gsap';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from "next-auth/react";
import Link from "next/link";
import DifficultyIcon from "./components/DifficultyIcon";
import { getPicrossSettings, setPicrossSettings } from './settings';
import { getMSTDateString } from './time';
import { ADMIN_EMAIL } from '../../lib/constants';
import dynamic from "next/dynamic";
const UserMenu = dynamic(() => import("../components/UserMenu"), { ssr: false });
import StatsModal, { prefetchStats } from './components/StatsModal';
import PastPuzzlesModal from './components/PastPuzzlesModal';
import { createEmptyGrid } from './runUtils';

const TUTORIAL_PAGES: { text: React.ReactNode; image: string; imageAlt: string }[] = [
  {
    text: <>Solve the puzzle by filling the correct squares to reveal the hidden picture. <br/><b>The numbers on the left and top tell you how many filled squares appear in each row and column, and in what order.</b></>,
    image: '/demoPic.jpg',
    imageAlt: 'Demo Nonogram',
  },
  {
    text: <>On a <b>5x5</b> grid, if you see a <b>5</b>, you can fill in the whole row like this</>,
    image: '/demo1.gif',
    imageAlt: 'Demo Nonogram',
  },
  {
    text: <>A <b>0</b> means there won&apos;t be any filled squares in that row or column, so we can cross them all out.</>,
    image: '/demo2.gif',
    imageAlt: 'Demo Nonogram',
  },
  {
    text: <>Multiple numbers must have at least one gap between them, like this</>,
    image: '/demo3.gif',
    imageAlt: 'Demo Nonogram',
  },
  {
    text: <>Use information from the rows to determine what to fill in the columns.</>,
    image: '/demo4.gif',
    imageAlt: 'Demo Nonogram',
  },
  {
    text: <>Use deduction and logic to solve the puzzle! <br/><b>Good luck and happy solving!</b></>,
    image: '/demo5.gif',
    imageAlt: 'Demo Nonogram',
  },
];

const TIPS_PAGES: { text: React.ReactNode; image: string; imageAlt: string }[] = [
  {
    text: <><b>Look for numbers that add up to 10:</b> If the numbers and their gaps for a row or column add up to ten, you can fill it all the way in right away!</>,
    image: '/add10Demo.gif',
    imageAlt: 'Overlap Example',
  },
  {
    text: <><b>Look for overlaps:</b> Large numbers in a row or column have an area in the middle that overlaps when counting from either direction. You can fill this area in, knowing that it must be filled in any configuration. </>,
    image: '/overlapDemo.gif',
    imageAlt: 'Overlap Example',
  },
  {
    text: <><b>Use <b style={{color: '#ff0404'}}>X</b> to mark empty squares:</b> In general it's good to mark squares you know are empty to help visualize potential placements for filled squares. For example, this can make the overlap area larger.</>,
    image: '/blanksDemo.gif',
    imageAlt: 'Tips placeholder',
  },
  {
    text: <><b>Sometimes you have to count it out:</b> You can use the overlap technique in rows with multiple numbers, just account for spaces between groups. Even confirming 1 square can be crucial to finding the solution!</>,
    image: '/overlap2Demo.gif',
    imageAlt: 'Count It Out Example',
  }
];

function TutorialPages({ pages }: { pages: typeof TUTORIAL_PAGES }) {
  const [page, setPage] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const directionRef = useRef<1 | -1>(1); // 1 = forward, -1 = backward
  const prevPagesRef = useRef(pages);
  const pageRef = useRef(page);
  pageRef.current = page;
  const pageMemoryRef = useRef(new Map<typeof TUTORIAL_PAGES, number>());

  // useLayoutEffect runs synchronously before the browser paints, so gsap.set(opacity:0)
  // is invisible to the user. animKey is incremented to guarantee the animation effect
  // fires even when the page index doesn't change between tabs.
  useLayoutEffect(() => {
    if (prevPagesRef.current === pages) return;
    const targets = [textRef.current, imgRef.current].filter(Boolean);
    gsap.killTweensOf(targets);
    gsap.set(targets, { opacity: 0 });
    pageMemoryRef.current.set(prevPagesRef.current, pageRef.current);
    prevPagesRef.current = pages;
    directionRef.current = 1;
    setPage(pageMemoryRef.current.get(pages) ?? 0);
    setAnimKey(k => k + 1);
  }, [pages]);

  const navigate = (next: number) => {
    if (next === page) return;
    directionRef.current = next > page ? 1 : -1;
    const targets = [textRef.current, imgRef.current].filter(Boolean);
    gsap.to(targets, {
      opacity: 0,
      x: directionRef.current * -24,
      duration: 0.18,
      ease: 'power2.in',
      onComplete: () => setPage(next),
    });
  };

  useEffect(() => {
    const targets = [textRef.current, imgRef.current].filter(Boolean);
    gsap.fromTo(targets,
      { opacity: 0, x: directionRef.current * 24 },
      { opacity: 1, x: 0, duration: 0.22, ease: 'power2.out' },
    );
  }, [page, animKey]);

  const safePage = Math.min(page, pages.length - 1);
  const current = pages[safePage];
  const btnStyle: React.CSSProperties = { fontFamily: COURIER_FONT, fontWeight: 700, padding: '5px 14px', borderRadius: 6, border: '2px solid #cca3ff', background: '#fff', color: '#7c3aed', cursor: 'pointer', fontSize: 14 };
  const btnDisabledStyle: React.CSSProperties = { ...btnStyle, opacity: 0.35, cursor: 'default' };

  return (
    <div className="tutorial-layout">
      <p ref={textRef} className="tutorial-text" style={{ marginTop: 0, marginBottom: 0, color: '#333' }}>
        {current.text}
      </p>
      <div className="tutorial-image">
        <img ref={imgRef} src={current.image} alt={current.imageAlt} style={{ width: '100%', borderRadius: 8 }} />
      </div>
      <div className="tutorial-nav" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button style={safePage === 0 ? btnDisabledStyle : btnStyle} disabled={safePage === 0} onClick={() => navigate(safePage - 1)}>← Prev</button>
        <span style={{ fontSize: 13, color: '#666' }}>{safePage + 1} / {pages.length}</span>
        <button style={safePage === pages.length - 1 ? btnDisabledStyle : btnStyle} disabled={safePage === pages.length - 1} onClick={() => navigate(safePage + 1)}>Next →</button>
      </div>
    </div>
  );
}

const difficulties = [
  { label: "Easy (5x5)", value: "easy", size: 5 },
  { label: "Medium (10x10)", value: "medium", size: 10 },
  { label: "Hard (15x15)", value: "hard", size: 15 },
];

// Placeholder puzzles for each difficulty
const demoPuzzles: Record<string, boolean[][]> = {
  easy: createEmptyGrid(5, false),
  medium: createEmptyGrid(10, false),
  hard: createEmptyGrid(15, false),
};


const COURIER_FONT = "var(--font-courier-prime), 'Courier New', monospace";

function PicrossSplashInner() {
  const [difficulty] = useState("easy");
  const { data: session } = useSession();
  const isTyler = !!(session?.user?.email && session.user.email.trim().toLowerCase() === ADMIN_EMAIL);
  const isAuthenticated = !!(session?.user?.email);
  const { progress, puzzle, setPrefetch, fetchPrefetch } = usePicrossPrefetch();
  // Ensure progress is always an object and never null
  const safeProgress = (progress && typeof progress === 'object') ? progress : {};
  const typedProgress = safeProgress as Record<string, import("./PicrossPrefetchContext").CellState[][] | undefined>;
  const typedPuzzle = (puzzle || {}) as Record<string, boolean[][] | undefined>;


  const isCompleted = (diff: string) => {
    const prog = typedProgress[diff];
    if (!prog) return false;
    const puz = typedPuzzle[diff];
    if (puz && Array.isArray(puz) && puz.length === prog.length) {
      for (let r = 0; r < puz.length; r++) {
        for (let c = 0; c < (puz[r] || []).length; c++) {
          const should = !!(puz[r] && puz[r][c]);
          const has = prog[r] && typeof prog[r][c] !== 'undefined' ? prog[r][c] === 1 : false;
          if (should !== has) return false;
        }
      }
      return true;
    }
    // fallback: consider complete if every cell in progress is filled (1)
    const allFilled = prog.length > 0 && prog.every(row => Array.isArray(row) && row.every(v => v === 1));
    return allFilled;
  };
  // Prefetching and fetch-on-login are handled by PicrossPrefetchProvider

  const dailyTitleRef = useRef<HTMLHeadingElement | null>(null);
  const dailyAnimStartedRef = useRef(false);
  const dailySubtitleRef = useRef<HTMLDivElement | null>(null);
  const replayTimeoutRef = useRef<number | null>(null);
  const stopDailyAnimations = () => {
    try {
      const letters = dailyTitleRef.current ? Array.from(dailyTitleRef.current.querySelectorAll('.daily-letter')) as HTMLElement[] : [];
      gsap.killTweensOf(letters);
      gsap.killTweensOf(dailySubtitleRef.current as any);
      if (dailySubtitleRef.current) {
        dailySubtitleRef.current.style.opacity = '1';
        dailySubtitleRef.current.style.transform = 'translateY(0px)';
      }
      // clear any pending replay timeout so it can't navigate after we leave
      try { if (replayTimeoutRef.current) { window.clearTimeout(replayTimeoutRef.current); replayTimeoutRef.current = null; } } catch {}
    } catch (err) {
      // ignore
    }
  };
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [tutorialTab, setTutorialTab] = useState<'how' | 'tips'>('how');
  const [showPastPuzzles, setShowPastPuzzles] = useState(false);
  const [calendarYear, setCalendarYear] = useState<number | undefined>(undefined);
  const [calendarMonth, setCalendarMonth] = useState<number | undefined>(undefined);

  // Prefetch stats in the background so the popup opens instantly.
  // Also listen for pageshow (fires on bfcache restore when using phone back)
  // so stats are refreshed even when the page isn't remounted.
  useEffect(() => {
    if (isAuthenticated) prefetchStats();
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted && isAuthenticated) prefetchStats();
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [isAuthenticated]);

  const [playStartAnimation, setPlayStartAnimation] = useState<boolean>(() => {
    try { return !!getPicrossSettings().playStartAnimation; } catch { return true; }
  });

  // If the user has the START animation enabled and they haven't started a
  // puzzle today for a given difficulty, clear the per-date `startShown` flag
  // so the START animation will play. Do this on mount and whenever progress
  // or the playStartAnimation setting changes.
  useEffect(() => {
    (async () => {
      try {
        const dateStr = getMSTDateString();
        if (!playStartAnimation) return;
        let serverProgress: any = null;
        try {
          if (session?.user?.email) {
            const res = await fetch(`/api/picross/progress?date=${dateStr}`);
            if (res.ok) serverProgress = await res.json();
          }
        } catch {}

        // If the user is authenticated and the server returned no progress
        // row for today, prefer the server and clear any leftover local
        // seconds/progress values that may have been left from an anonymous
        // session. This prevents stale local keys from suppressing START.
        if (session?.user?.email && serverProgress == null) {
          try {
            for (const dd of ['easy','medium','hard']) {
              try { window.localStorage.removeItem(`picross:seconds:${dateStr}:${dd}`); } catch {}
              try { window.localStorage.removeItem(`picross:progress:${dateStr}:${dd}`); } catch {}
            }
          } catch {}
        }

        for (const d of ['easy','medium','hard']) {
          try {
            // Only rely on recorded seconds to determine whether the user has
            // actually started the puzzle. This avoids false positives from
            // an initialized-but-empty progress array.
            let hasProgress = false;
            try {
              if (serverProgress) {
                const field = d + 'Seconds';
                const sv = serverProgress && typeof serverProgress[field] === 'number' ? Number(serverProgress[field]) || 0 : 0;
                if (sv > 0) hasProgress = true;
              }
            } catch {}
            try {
              const secKey = `picross:seconds:${dateStr}:${d}`;
              const rawSec = typeof window !== 'undefined' ? window.localStorage.getItem(secKey) : null;
              const secVal = rawSec ? Number(rawSec) || 0 : 0;
              if (secVal > 0) hasProgress = true;
            } catch {}
            try {
              const progKey = `picross:progress:${dateStr}:${d}`;
              const rawProg = typeof window !== 'undefined' ? window.localStorage.getItem(progKey) : null;
              if (rawProg) {
                const parsed = JSON.parse(rawProg) as { seconds?: number } | null;
                if (parsed && typeof parsed.seconds === 'number' && parsed.seconds > 0) hasProgress = true;
              }
            } catch {}
            if (!hasProgress) {
              try { window.localStorage.removeItem(`picross:startShown:${dateStr}:${d}`); } catch {}
              try { window.localStorage.removeItem(`picross:startShown:${dateStr}`); } catch {}
            } else {
              // do nothing here; play page will set shown flag when animation completes
            }
          } catch {}
        }
      } catch {}
    })();
  }, [playStartAnimation, progress, session?.user?.email]);
  const saveSettings = () => {
    try { setPicrossSettings({ playStartAnimation }); } catch {}
    // If user enabled the START animation, clear today's shown flag so it can play
    try {
      if (playStartAnimation) {
        const dateStr = getMSTDateString();
        for (const d of ['easy','medium','hard']) {
          try { window.localStorage.removeItem(`picross:startShown:${dateStr}:${d}`); } catch {}
        }
        try { window.localStorage.removeItem(`picross:startShown:${dateStr}`); } catch {}
      }
    } catch {}
    setShowSettings(false);
  };

  const resetStartShown = () => {
    try {
      const dateStr = getMSTDateString();
      for (const d of ['easy','medium','hard']) {
        try { window.localStorage.removeItem(`picross:startShown:${dateStr}:${d}`); } catch {}
      }
      try { window.localStorage.removeItem(`picross:startShown:${dateStr}`); } catch {}
      alert('START shown state reset for today.');
    } catch (err) { console.debug('reset startShown failed', err); }
  };
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const el = dailyTitleRef.current;
    if (!el) return;
    const replay = !!(searchParams && searchParams.get && searchParams.get('replay'));
    if (dailyAnimStartedRef.current && !replay) return;
    const original = el.textContent || 'Daily Nonograms';

    // Defer all DOM work + GSAP to the next animation frame so that React
    // Strict Mode's synchronous cleanup (which fires between the two effect
    // invocations) can cancel the RAF before it commits to the screen.
    // This prevents the double-animation in dev while still playing correctly.
    let rafId: number | null = requestAnimationFrame(() => {
      rafId = null;
      dailyAnimStartedRef.current = false;
      const letters: HTMLElement[] = [];
      el.style.visibility = 'visible';
      el.innerHTML = '';
      for (const ch of Array.from(original)) {
        const span = document.createElement('span');
        span.className = 'daily-letter';
        span.style.display = 'inline-block';
        span.style.transformOrigin = 'center';
        span.textContent = ch === ' ' ? '\u00A0' : ch;
        letters.push(span);
        el.appendChild(span);
      }
      try {
        dailyAnimStartedRef.current = true;
        gsap.from(letters, {
          scale: 0.5,
          y: 12,
          opacity: 0,
          duration: 0.45,
          ease: 'back.out(1.6)',
          stagger: 0.04,
        });
        // Animate subtitle after the letters finish
        try {
          const subtitleEl = dailySubtitleRef.current;
          if (subtitleEl) {
            const letterDelay = Math.max(0.2, original.length * 0.04 + 0.05);
            const startDelay = 0.45 + letterDelay;
            gsap.to(subtitleEl, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', delay: startDelay });
          }
        } catch (err) { console.debug('gsap subtitle animation failed', err); }
      } catch (err) {
        console.debug('gsap daily title animation failed', err);
      }
      // If this was a replay request, clear the query param after animation starts
      if (replay) {
        try {
          try { if (replayTimeoutRef.current) { window.clearTimeout(replayTimeoutRef.current); replayTimeoutRef.current = null; } } catch {}
          replayTimeoutRef.current = window.setTimeout(() => { try { router.replace('/nonogram'); } catch {} }, 800) as unknown as number;
        } catch {}
      }
    });

    return () => {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      try { if (replayTimeoutRef.current) { window.clearTimeout(replayTimeoutRef.current); replayTimeoutRef.current = null; } } catch {}
      try { el.textContent = original; } catch {}
    };
  // re-run when the search params string changes (so ?replay=1 triggers it)
  }, [searchParams?.toString()]);

  // When returning from a past puzzle (?openCalendar=YYYY-MM), reopen the
  // calendar at the correct month. The shared context was never contaminated
  // (past puzzles use local state in the play page), so icons are already correct.
  // Call fetchPrefetch as a background refresh in case session just changed.
  useEffect(() => {
    const openCalendar = searchParams?.get?.('openCalendar');
    if (!openCalendar) return;
    const parts = openCalendar.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!y || !m) return;
    setCalendarYear(y);
    setCalendarMonth(m);
    setShowPastPuzzles(true);
    router.replace('/nonogram');
    fetchPrefetch();
  }, [searchParams?.toString()]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate to a past puzzle. The play page manages its own data loading via
  // local state so we never overwrite the shared context (which drives today's icons).
  const handleSelectPuzzle = (date: string, difficulty: string) => {
    setShowPastPuzzles(false);
    stopDailyAnimations();
    router.push(`/nonogram/play?date=${date}&difficulty=${difficulty}&fromCalendar=${date.slice(0, 7)}`);
  };

  return (
    <div className="nonogram-root" style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 0, paddingTop: 24, position: "relative", background: '#cca3ff', minHeight: '100vh', width: '100%', colorScheme: 'light' }}>
      <div style={{ position: "absolute", top: 16, right: 24, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAuthenticated && (
            <button
              aria-label="Settings"
              title="Settings"
              onClick={() => setShowSettings(true)}
              style={{
                background: '#23272f',
                color: '#fff',
                border: 'none',
                width: 40,
                height: 40,
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: 28,
                paddingTop: 8,
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
              }}
            >
              ⚙
            </button>
          )}
          {isTyler && (
            <button
              aria-label="Past Puzzles"
              title="Past Puzzles"
              onClick={() => setShowPastPuzzles(true)}
              style={{
                background: '#23272f', color: '#fff', border: 'none',
                width: 40, height: 40, borderRadius: 8,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
                <rect x="1" y="4" width="18" height="14" rx="2" fill="none" stroke="white" strokeWidth="1.8"/>
                <line x1="5" y1="2" x2="5" y2="6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <line x1="15" y1="2" x2="15" y2="6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <line x1="1" y1="8.5" x2="19" y2="8.5" stroke="white" strokeWidth="1.5"/>
                <rect x="4" y="11" width="2.5" height="2.5" rx="0.5" fill="white"/>
                <rect x="8.75" y="11" width="2.5" height="2.5" rx="0.5" fill="white"/>
                <rect x="13.5" y="11" width="2.5" height="2.5" rx="0.5" fill="white"/>
                <rect x="4" y="15" width="2.5" height="2" rx="0.5" fill="white"/>
                <rect x="8.75" y="15" width="2.5" height="2" rx="0.5" fill="white"/>
              </svg>
            </button>
          )}
          {isAuthenticated && (
            <button
              aria-label="Stats"
              title="Stats"
              onClick={() => setShowStats(true)}
              style={{
                background: '#23272f',
                color: '#fff',
                border: 'none',
                width: 40,
                height: 40,
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: 22,
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="white">
                <rect x="1" y="11" width="4" height="8" rx="1"/>
                <rect x="7.5" y="6" width="4" height="13" rx="1"/>
                <rect x="14" y="1" width="4" height="18" rx="1"/>
              </svg>
            </button>
          )}
          <UserMenu />
        </div>
      </div>
      <h1 ref={dailyTitleRef} style={{ fontFamily: COURIER_FONT, fontSize: 36, lineHeight: 1, marginTop: 75, marginBottom: 20, fontWeight: 900, letterSpacing: 3, color: '#111', visibility: 'hidden', whiteSpace: 'nowrap' }}>Daily Nonograms</h1>
      <div ref={dailySubtitleRef} style={{ fontFamily: COURIER_FONT, fontSize: 14, fontWeight: 500,  marginTop: -8, marginBottom: 12, color: '#1f1f1f', opacity: 0, transform: 'translateY(8px)' }}>All puzzles designed by <Link href="/" style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3 }}>Tyler Apsley</Link></div>
      <div className="difficulty-row">
        {difficulties.map(d => {
          const disabled = (d.value === 'hard' && !isTyler) || (d.value === 'medium' && !isAuthenticated);
          const containerStyle: React.CSSProperties = { border: "3px solid #7c7c7c", borderRadius: 12, background: "#fff", padding: 12, cursor: disabled ? 'default' : 'pointer', display: "inline-block", position: 'relative' };
          return (
            <div key={d.value} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {disabled ? (
                <div className="nonogram-difficulty-btn disabled" style={containerStyle}>
                  <DifficultyIcon grid={typedPuzzle[d.value] ?? demoPuzzles[d.value]} progress={typedProgress[d.value] || undefined} size={140} celebrate={isCompleted(d.value)} />
                  <div style={{ fontFamily: COURIER_FONT, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.9)', borderRadius: 8, fontWeight: 800, color: '#333' }}>
                    {d.value === 'hard' ? 'Coming soon!' : d.value === 'medium' ? 'Sign in to play!' : 'Locked'}
                  </div>
                </div>
              ) : (
                <Link
                  href={`/nonogram/play?difficulty=${d.value}`}
                  className="nonogram-difficulty-btn"
                  style={containerStyle}
                  prefetch={true}
                  onClick={() => { stopDailyAnimations(); }}
                >
                  <DifficultyIcon grid={typedPuzzle[d.value] ?? demoPuzzles[d.value]} progress={typedProgress[d.value] || undefined} size={140} celebrate={isCompleted(d.value)} />
                </Link>
              )}
              <div style={{ fontFamily: COURIER_FONT, marginTop: 12, fontWeight: difficulty === d.value ? "bold" : 600, fontSize: 18 }}>{d.label}</div>
            </div>
          );
        })}
      </div>

      {showSettings && (
        <div onClick={() => setShowSettings(false)} style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', zIndex: 2000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#2c2c2c', padding: 18, borderRadius: 8, minWidth: 300, maxWidth: 420, border: '1px solid rgba(255,255,255,0.06)', fontFamily: COURIER_FONT, color: '#fff' }}>
            <div style={{ fontWeight: 700, marginBottom: 12, color: '#fff', fontFamily: COURIER_FONT, letterSpacing: '0.2em' }}>SETTINGS</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontSize: 16, fontFamily: COURIER_FONT }}>
                <input className="picross-checkbox" type="checkbox" checked={playStartAnimation} onChange={e => setPlayStartAnimation(e.target.checked)} />
                <span>Play START animation when beginning a puzzle</span>
              </label>
              {/* showTimer setting hidden for now */}
            </div>
            {isTyler && (
              <div style={{ marginBottom: 12 }}>
                <button onClick={resetStartShown} style={{ cursor: "pointer" ,padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: '#111', color: '#fff', fontFamily: COURIER_FONT }}>Reset START shown for today</button>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowSettings(false)} style={{ cursor: "pointer" ,padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: '#111', color: '#fff', fontFamily: COURIER_FONT }}>Close</button>
              <button onClick={saveSettings} style={{ cursor: "pointer" ,padding: '8px 10px', borderRadius: 6, background: '#d579ff', color: '#000000', border: 'none', fontFamily: COURIER_FONT }}>Save</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ width: 'min(1000px, 92%)', marginBottom: 48, color: '#111' }}>
        {/* Tab strip */}
        <div style={{ display: 'flex', gap: 0, paddingLeft: 0, alignItems: 'flex-end' }}>
          {(['how', 'tips'] as const).map((tab) => {
            const active = tutorialTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setTutorialTab(tab)}
                style={{
                  fontFamily: COURIER_FONT,
                  fontWeight: 800,
                  fontSize: 20,
                  padding: '8px 20px',
                  marginRight: 5,
                  borderRadius: '8px 8px 0 0',
                  cursor: active ? 'default' : 'pointer',
                  background: active ? '#fff' : '#ede0ff',
                  color: '#000000',
                  position: 'relative',
                  bottom: active ? '-2px' : '0',
                  zIndex: active ? 2 : 1,
                  transition: 'background 0.15s',
                }}
              >
                {tab === 'how' ? 'HOW TO PLAY' : 'TIPS & TRICKS'}
              </button>
            );
          })}
        </div>
        {/* Card */}
        <div style={{ background: '#fff', borderRadius: '0px 8px 8px 8px', padding: 24, boxShadow: '0 8px 30px rgba(0,0,0,0.08)',  position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: COURIER_FONT }}>
            <TutorialPages pages={tutorialTab === 'how' ? TUTORIAL_PAGES : TIPS_PAGES} />
          </div>
        </div>
      </div>
      {isTyler && (
        <PastPuzzlesModal
          open={showPastPuzzles}
          onClose={() => setShowPastPuzzles(false)}
          onSelectPuzzle={handleSelectPuzzle}
          initialYear={calendarYear}
          initialMonth={calendarMonth}
        />
      )}
      <StatsModal open={showStats} onClose={() => setShowStats(false)} isAdmin={isTyler} />
      <style jsx>{`
        :global(.tutorial-layout) {
          display: grid;
          grid-template-columns: 1fr 350px;
          grid-template-rows: 1fr auto;
          gap: 16px 24px;
        }
        :global(.tutorial-text)  { grid-column: 1; grid-row: 1; align-self: start; }
        :global(.tutorial-image) { grid-column: 2; grid-row: 1 / 3; }
        :global(.tutorial-nav)   { grid-column: 1; grid-row: 2; align-self: end; }
        @media (max-width: 680px) {
          :global(.tutorial-layout) { grid-template-columns: 1fr; }
          :global(.tutorial-text)  { grid-column: 1; grid-row: 1; height: 200px;}
          :global(.tutorial-image) { grid-column: 1; grid-row: 2; }
          :global(.tutorial-nav)   { grid-column: 1; grid-row: 3; }
        }
        .difficulty-row {
          display: flex;
          gap: 40px;
          margin: 50px;
          align-items: flex-end;
          flex-wrap: nowrap;
          justify-content: center;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        @media (max-width: 600px) {
          .difficulty-row {
            flex-direction: column;
            align-items: center;
            gap: 16px;
            margin: 24px;
          }
          .nonogram-difficulty-btn {
            width: 100%;
            max-width: 320px;
          }
        }
        .nonogram-difficulty-btn {
          border: 3px solid #7c7c7c;
          transition: border-color 120ms, transform 120ms, box-shadow 120ms;
          min-width: 160px;
        }
        .nonogram-difficulty-btn:not(.disabled):hover {
          border: 3px solid #0070f3 !important;
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(3,102,214,0.12);
        }
      `}</style>
      <style jsx>{`
        .picross-checkbox {
          -webkit-appearance: none;
          -moz-appearance: none;
          appearance: none;
          width: 30px;
          height: 25px;
          border: 2px solid #ffffff;
          background: #f3f3f3;
          display: inline-block;
          vertical-align: middle;
          border-radius: 2px;
          margin-right: 8px;
          box-sizing: border-box;
          position: relative;
          cursor: pointer;

        }
        .picross-checkbox:checked {
          background: #000;
          border-color: #fff;
        }
      `}</style>
    </div>
  );
}

export default function PicrossSplash() {
  return (
    <Suspense fallback={<div />}>
      <PicrossSplashInner />
    </Suspense>
  );
}

