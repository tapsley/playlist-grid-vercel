"use client";
import { useState } from 'react';

const SCREENS = [
  { label: 'Home Page',              old: '/ufaPicks/oldHome.png',        new: '/ufaPicks/newHome.png' },
  { label: 'Create Account',         old: '/ufaPicks/oldRegister.png',    new: '/ufaPicks/newRegister.png' },
  { label: 'Sign In',                old: '/ufaPicks/oldLogin.png',       new: '/ufaPicks/newLogin.png' },
  { label: 'Forgot Password',        old: '/ufaPicks/oldForgot.png',      new: '/ufaPicks/newForgot.png' },
  { label: 'Weeks of the Season',    old: '/ufaPicks/oldGames.png',       new: '/ufaPicks/newGames.png' },
  { label: 'Game Scores',            old: '/ufaPicks/oldWeek.png',        new: '/ufaPicks/newWeek.png' },
  { label: 'Player Picks',           old: '/ufaPicks/oldPicks.png',       new: '/ufaPicks/newPicks.png' },
  { label: 'Score Prediction',       old: '/ufaPicks/oldPreweek.png',     new: '/ufaPicks/newPreweek.png' },
  { label: 'Leaderboard',            old: '/ufaPicks/oldLeaderboard.png', new: '/ufaPicks/newLeaderboard.png' },
  { label: 'User Profile',           old: '/ufaPicks/oldProfile.png',     new: '/ufaPicks/newProfile.png' },
];

const FLIP_STYLES = `
  @keyframes ufa-flip-out {
    from { transform: rotateY(0deg); }
    to   { transform: rotateY(90deg); }
  }
  @keyframes ufa-flip-in {
    from { transform: rotateY(-90deg); }
    to   { transform: rotateY(0deg); }
  }
  .ufa-flip-out { animation: ufa-flip-out 0.17s ease-in  forwards; }
  .ufa-flip-in  { animation: ufa-flip-in  0.17s ease-out forwards; }
  .ufa-card:hover .ufa-flip-hint { opacity: 1 !important; }
`;

function FlipCard({ label, oldSrc, newSrc }: { label: string; oldSrc: string; newSrc: string }) {
  const [showNew, setShowNew] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'out' | 'in'>('idle');

  const handleClick = () => {
    if (phase !== 'idle') return;
    setPhase('out');
  };

  const handleAnimationEnd = () => {
    if (phase === 'out') {
      setShowNew(v => !v);
      setPhase('in');
    } else if (phase === 'in') {
      setPhase('idle');
    }
  };

  return (
    <div
      className="ufa-card"
      onClick={handleClick}
      style={{
        position: 'relative',
        cursor: 'pointer',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.13)',
        perspective: '800px',
        userSelect: 'none',
      }}
    >
      {/* Top banner */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        zIndex: 2,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '7px 10px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0) 100%)',
        pointerEvents: 'none',
      }}>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, letterSpacing: '0.03em', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
          {label}
        </span>
        <span style={{
          background: showNew ? '#16a34a' : '#2563eb',
          color: '#fff',
          borderRadius: 5,
          padding: '2px 9px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          transition: 'background 0.12s',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}>
          {showNew ? 'NEW' : 'OLD'}
        </span>
      </div>

      {/* Flip hint */}
      <div
        className="ufa-flip-hint"
        style={{
          position: 'absolute',
          bottom: 8, right: 10,
          zIndex: 2,
          color: 'rgba(255,255,255,0.75)',
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.05em',
          pointerEvents: 'none',
          opacity: 0,
          transition: 'opacity 0.2s',
          textShadow: '0 1px 3px rgba(0,0,0,0.7)',
        }}
      >
        tap to flip ↺
      </div>

      {/* Card face */}
      <div
        className={phase === 'out' ? 'ufa-flip-out' : phase === 'in' ? 'ufa-flip-in' : ''}
        onAnimationEnd={handleAnimationEnd}
        style={{ transformOrigin: 'center', paddingTop: 40 }}
      >
        <img
          src={showNew ? newSrc : oldSrc}
          alt={`${label} — ${showNew ? 'new' : 'old'}`}
          style={{ width: '100%', display: 'block' }}
        />
      </div>
    </div>
  );
}

export default function UfaPicksPage() {
  return (
    <div className="bg-white text-gray-900">
      <style>{FLIP_STYLES}</style>

      {/* Header */}
      <div className="py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">UFA Picks Rebrand</h1>
          <p className="text-md mb-2">My friend asked me to update the Look and Feel for <a href="https://profrisbeepicks.com" className="text-blue-500 underline" target="_blank" rel="noopener noreferrer">UFA Picks</a>, a site that he made to predict scores and compete with friends while following the Ultimate Frisbee Association.</p>
          <p className="text-md mb-2">I enhanced the overall flow while adding more color and a consistent theme.</p>
          <p className="text-md mb-2"><b>Sign In</b> and <b>Account Creation</b> are now entirely handled in a modal on the home page.</p>
          <p className="text-md mb-2">Viewing <b>Players Picks</b> is now handled in a modal within the game details page, making comparing your predictions to your friends&apos; easier than ever.</p>
          <p className="text-md mb-4"><b>Click any image to flip between the before and after!</b></p>
        </div>
      </div>

      {/* Grid of flip cards */}
      <div className="px-4 pb-12">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          {SCREENS.map(s => (
            <FlipCard key={s.label} label={s.label} oldSrc={s.old} newSrc={s.new} />
          ))}
        </div>
      </div>
    </div>
  );
}
