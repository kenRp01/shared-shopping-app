"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { getCurrentUser, signOutLocal } from "@/lib/local-store";
import type { UserProfile } from "@/lib/types";

const THEME_STORAGE_KEY = "shareshopi:theme";
type AppTheme = "dark" | "light";

export function Nav() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [theme, setTheme] = useState<AppTheme>("dark");

  useEffect(() => {
    const loadUser = () => {
      getCurrentUser().then(setUser);
    };
    const idleId =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(loadUser, { timeout: 1200 })
        : globalThis.setTimeout(loadUser, 250);

    return () => {
      if (typeof window.cancelIdleCallback === "function" && typeof idleId === "number") {
        window.cancelIdleCallback(idleId);
      } else {
        globalThis.clearTimeout(idleId);
      }
    };
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const nextTheme: AppTheme = savedTheme === "light" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  function toggleTheme() {
    setTheme((current) => {
      const nextTheme: AppTheme = current === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      document.documentElement.dataset.theme = nextTheme;
      return nextTheme;
    });
  }

  return (
    <header className="topbar">
      <Link href="/" aria-label="トップへ戻る">
        <Logo />
      </Link>
      <nav className="topnav">
        <button
          type="button"
          className="ghost-button nav-icon-link theme-toggle-button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "ライトモードに切り替え" : "ダークモードに切り替え"}
          title={theme === "dark" ? "ライトモード" : "ダークモード"}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
        {user ? (
          <>
            <button
              type="button"
              className="ghost-button nav-icon-link"
              onClick={async () => {
                await signOutLocal();
                window.location.href = "/";
              }}
              aria-label="ログアウト"
              title="ログアウト"
            >
              <LogoutIcon />
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="nav-icon-link" aria-label="ログイン" title="ログイン">
              <LoginIcon />
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.4 14.3A8.6 8.6 0 0 1 9.7 3.6a7.5 7.5 0 1 0 10.7 10.7Z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 17v2a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v2" />
      <path d="M15 12H4" />
      <path d="m8 8-4 4 4 4" />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
      <path d="M10 12h10" />
      <path d="m16 8 4 4-4 4" />
    </svg>
  );
}
