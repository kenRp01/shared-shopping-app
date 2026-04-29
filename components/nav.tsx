"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { getCurrentUser, signOutLocal } from "@/lib/local-store";
import type { UserProfile } from "@/lib/types";

export function Nav() {
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  return (
    <header className="topbar">
      <Logo />
      <nav className="topnav">
        {user ? (
          <>
            <span className="nav-pill nav-user-pill" aria-label={user.name} title={user.name}>
              <UserIcon />
            </span>
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

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M5 20a7 7 0 0 1 14 0" />
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
