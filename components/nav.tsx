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
        <Link href="/">ホーム</Link>
        <Link href="/lists/new">新しいリスト</Link>
        {user ? (
          <>
            <span className="nav-pill">{user.name}</span>
            <button
              type="button"
              className="ghost-button"
              onClick={async () => {
                await signOutLocal();
                window.location.href = "/";
              }}
            >
              ログアウト
            </button>
          </>
        ) : (
          <>
            <Link href="/login">ログイン</Link>
            <Link href="/signup" className="nav-cta">
              無料ではじめる
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
