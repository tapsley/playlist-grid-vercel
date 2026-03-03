"use client";

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import React, { createContext, useState, useEffect } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const metadata: Metadata = {
  title: "Tyler Apsley's Space",
  description: "A space for Tyler Apsley's experiments and musings",
};

import Header from "./components/Header";

export const DarkModeContext = createContext({
  isDarkMode: false,
  toggle: () => {},
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  // sync with localStorage for persistence
  useEffect(() => {
    const saved = localStorage.getItem("daily-notes-dark-mode");
    if (saved) {
      setIsDarkMode(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("daily-notes-dark-mode", JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggle = () => setIsDarkMode((v) => !v);

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <DarkModeContext.Provider value={{ isDarkMode, toggle }}>
          <Header />
          {children}
        </DarkModeContext.Provider>
      </body>
    </html>
  );
}
