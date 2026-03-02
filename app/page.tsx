import Link from "next/link";
import React from "react";

export default function SplashPage() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <section style={{ maxWidth: 980, width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 36 }}>Hello — My name is Tyler Apsley</h1>
            <p style={{ margin: "6px 0 0", color: "#6b7280" }}>Welcome to my little corner of the internet. Check out some of my projects below</p>
          </div>
  
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 360px" }}>

              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <Link href="/resume" style={secondaryButtonStyle}>Resume</Link>
                <Link href="/playlist" style={ctaButtonStyle}>Playlist Grid feat. Spotify</Link>
                
              </div>
            </div>

          </div>

          <footer style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <small style={{ color: "#6b7280" }}>Built with care — open to opportunities.</small>

          </footer>
        </div>
      </section>
    </main>
  );
}

const navButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  background: "transparent",
  color: "#111827",
  textAlign: "center",
  textDecoration: "none",
  border: "1px solid transparent",
};

const ctaButtonStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  background: "#111827",
  color: "#fff",
  textAlign: "center",
  textDecoration: "none",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  background: "#e5e7eb",
  color: "#111827",
  textAlign: "center",
  textDecoration: "none",
};

const linkStyle: React.CSSProperties = {
  color: "#111827",
  textDecoration: "underline",
  textDecorationThickness: 1,
};
