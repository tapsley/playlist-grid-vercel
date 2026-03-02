import Link from "next/link";
import React from "react";
import { SocialIcon } from 'react-social-icons';

export default function Header() {
  return (
    <header style={{
      width: "100%",
      borderBottom: "1px solid #e5e7eb",
      padding: "12px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "#141414",
      position: "sticky",
      top: 0,
      zIndex: 50
    }}>
      
      <div className="flex items-center gap-2 mt-2">
        <Link href="/" style={{ textDecoration: "none", fontSize: 35, color: "#fff0fc", fontWeight: 600, fontFamily: "Goudy Bookletter 1911" }}>
        Tyler Apsley 
      </Link>
        <SocialIcon url="https://instagram.com/tyler.apsley" className="colorscheme" style={{ width: 40, height: 40 }}/>
        <SocialIcon url="https://linkedin.com/in/tyler-apsley"  className="colorscheme" style={{ width: 40, height: 40 }}/>
        <SocialIcon url="https://github.com/tapsley"  className="colorscheme" style={{ width: 40, height: 40 }}/>
        <SocialIcon url="https://open.spotify.com/user/128314269?si=7stLtgogQ4ii2PMvWnD72g"  className="colorscheme" style={{ width: 40, height: 40 }}/>
        </div>
      <nav style={{ display: "flex", gap: 12 }}>
        <Link href="/playlist" style={{ color: "#111827", textDecoration: "none" }}>Projects</Link>
        <Link href="/resume" style={{ color: "#111827", textDecoration: "none" }}>Resume</Link>
      </nav>
    </header>
  );
}
