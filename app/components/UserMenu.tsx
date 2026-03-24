"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import { FaGoogle, FaSignOutAlt, FaTrophy } from "react-icons/fa";
import { useState } from "react";

export default function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") return <div style={{ minWidth: 140, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>Loading...</div>;

  if (!session) {
    return (
      <button
        onClick={() => signIn("google")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#fff",
          color: "#333",
          border: "1px solid #aaa",
          borderRadius: 6,
          padding: "6px 16px",
          fontWeight: 500,
          fontSize: 16,
          cursor: "pointer",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)"
        }}
      >
        <FaGoogle style={{ color: "#4285F4", fontSize: 20 }} /> Sign in
      </button>
    );
  }

  return (
    <UserMenuWithStats session={session} />
  );
}

function UserMenuWithStats({ session }: { session: any }) {
  const [showStats, setShowStats] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/picross/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.debug('stats fetch err', e);
    } finally {
      setLoading(false);
      setShowStats(true);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#23272f", borderRadius: 8, padding: "4px 8px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", position: 'relative' }}>
      {session.user?.image && (
        <img src={session.user.image} alt="avatar" style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #0070f3" }} />
      )}
      <span style={{ color: "#fff", fontWeight: 500, fontSize: 15, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.user?.name || session.user?.email}</span>
      <button
        onClick={() => fetchStats()}
        title="View solved puzzles"
        style={{ background: 'none', border: 'none', color: '#ffd700', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center' }}
        aria-label="Solved puzzles"
      >
        <FaTrophy />
      </button>
      <button
        onClick={() => signOut()}
        title="Sign out"
        style={{
          background: "none",
          border: "none",
          color: "#aaa",
          cursor: "pointer",
          fontSize: 20,
          marginLeft: 2,
          padding: 0,
          display: "flex",
          alignItems: "center"
        }}
      >
        <FaSignOutAlt />
      </button>

      {showStats && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: '#fff', color: '#000', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 12, minWidth: 220, zIndex: 60 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong>Solved Puzzles</strong>
            <button onClick={() => setShowStats(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
          {loading && <div>Loading…</div>}
          {!loading && stats && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div><strong>Easy</strong>: {stats.easy}</div>
                  <div><strong>Medium</strong>: {stats.medium}</div>
                  <div><strong>Hard</strong>: {stats.hard}</div>
                  {stats.admin && (
                    <>
                      <hr />
                      <div><strong>Today (all users)</strong>: {stats.admin.today.total}</div>
                      <div style={{ fontSize: 12, color: '#444' }}>Easy: {stats.admin.today.easy} • Medium: {stats.admin.today.medium} • Hard: {stats.admin.today.hard}</div>
                      <div style={{ marginTop: 8 }}><strong>All time (all users)</strong>: {stats.admin.allTime.total}</div>
                      <div style={{ fontSize: 12, color: '#444' }}>Easy: {stats.admin.allTime.easy} • Medium: {stats.admin.allTime.medium} • Hard: {stats.admin.allTime.hard}</div>
                      <div style={{ marginTop: 8 }}>
                        <strong>Last 7 days</strong>
                        <div style={{ maxHeight: 120, overflowY: 'auto', marginTop: 6 }}>
                          {stats.admin.perDate.map((d: any) => (
                            <div key={d.date} style={{ fontSize: 12 }}><strong>{d.date}</strong>: {d.total} (E:{d.easy} M:{d.medium} H:{d.hard})</div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
          )}
          {!loading && !stats && <div>No data</div>}
        </div>
      )}
    </div>
  );
}
