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
        <Link href="/" style={{ textDecoration: "none", paddingRight: 10, fontSize: 35, color: "#ff93e8", fontWeight: 600, fontFamily: "Goudy Bookletter 1911" }}>
        Tyler Apsley 
      </Link>
        <SocialIcon target="_blank" url="https://instagram.com/tyler.apsley" className="colorscheme" style={{ width: 40, height: 40 }}/>
        <SocialIcon target="_blank" url="https://linkedin.com/in/tyler-apsley"  className="colorscheme" style={{ width: 40, height: 40 }}/>
        <SocialIcon target="_blank" url="https://github.com/tapsley"  className="colorscheme" style={{ width: 40, height: 40 }}/>
        <SocialIcon target="_blank" url="https://open.spotify.com/user/128314269?si=7stLtgogQ4ii2PMvWnD72g"  className="colorscheme" style={{ width: 40, height: 40 }}/>
        <SocialIcon target="_blank" url="mailto:tyler.apsley@gmail.com" className="colorscheme" style={{ width: 40, height: 40 }}/>
        </div>
    </header>
  );
}
