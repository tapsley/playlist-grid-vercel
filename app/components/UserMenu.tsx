"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import { FaGoogle, FaSignOutAlt } from "react-icons/fa";
import { useState } from "react";

export default function UserMenu() {
  const { data: session, status } = useSession();

  const [showAuthModal, setShowAuthModal] = useState(false);
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
      try {
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
      } catch (err) {
        setIsSubmitting(false);
        setError("Could not create account");
        return;
      }
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setIsSubmitting(false);

    if (!result || (result as any).error) {
      setError(authMode === "signup" ? "Account created, but sign-in failed" : "Invalid email or password");
      return;
    }

    setShowAuthModal(false);
  }

  function handleGoogleSignIn() {
    signIn("google");
  }

  if (status === "loading") return <div style={{ minWidth: 140, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>Loading...</div>;

  if (!session) {
    return (
      <>
        <button
          onClick={() => setShowAuthModal(true)}
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
           Sign in
        </button>

        {showAuthModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', padding: 24, background: 'rgba(0,0,0,0.45)' }}>
            <div style={{ width: '100%', maxWidth: 420, borderRadius: 12, border: '1px solid rgba(0,0,0,0.12)', background: '#fff', padding: 20, color: '#000' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}><b>Log in or create an account</b></h2>
                <button onClick={() => setShowAuthModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              </div>

              <p style={{ marginTop: 8, marginBottom: 12, color: '#374151' }}>{authMode === 'signin' ? 'Sign in to continue.' : 'Create an account to continue.'}</p>

              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <button onClick={handleGoogleSignIn} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', color: '#333', border: '1px solid #aaa', borderRadius: 6, padding: '8px 12px', fontWeight: 600, cursor: 'pointer', flex: 1 }}>
                  <FaGoogle style={{ color: "#4285F4", fontSize: 20 }} /> Sign in with Google
                </button>
              </div>

              <hr />

              <form onSubmit={handleAuthSubmit} style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                <input placeholder="Username" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
                {error && <div style={{ color: 'red' }}>{error}</div>}
                <button type="submit" disabled={isSubmitting} style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
                  {isSubmitting ? (authMode === 'signin' ? 'Signing in…' : 'Creating account…') : authMode === 'signin' ? 'Sign In' : 'Sign Up'}
                </button>
              </form>

              <p style={{ marginTop: 12, marginBottom: 0, fontSize: 14, color: '#6b7280' }}>
                {authMode === 'signin' ? 'Need an account? ' : 'Already have an account? '}
                <button type="button" onClick={() => { setAuthMode((m) => (m === 'signin' ? 'signup' : 'signin')); setError(''); }} style={{ color: '#2563eb', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>
                  {authMode === 'signin' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <UserMenuWithStats session={session} />
  );
}

function UserMenuWithStats({ session }: { session: any }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#23272f", borderRadius: 8, padding: "4px 8px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", position: 'relative' }}>
      {session.user?.image && (
        <img src={session.user.image} alt="avatar" style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #0070f3" }} />
      )}
      <span style={{ color: "#fff", fontWeight: 500, fontSize: 15, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.user?.name || session.user?.email}</span>
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
    </div>
  );
}
