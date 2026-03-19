"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import { FaGoogle, FaSignOutAlt } from "react-icons/fa";

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
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#23272f", borderRadius: 8, padding: "4px 12px 4px 8px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
      {session.user?.image && (
        <img src={session.user.image} alt="avatar" style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #0070f3", marginRight: 4 }} />
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
          marginLeft: 4,
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
