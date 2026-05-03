"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { signInWithGoogle } from "@/lib/local-store";

export function AuthForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="auth-layout">
      <section className="panel hero-panel">
        <p className="eyebrow">Google Login</p>
        <h2>Googleアカウントで共有リストを使う</h2>
        <p className="lead-copy">
          共有リストはGoogleログインで安全に管理します。ひとり利用はログインなしでも続けられます。
        </p>
        <div className="mini-metrics">
          <div><strong>無料</strong><span>Supabase Auth</span></div>
          <div><strong>共有</strong><span>Googleユーザー指定</span></div>
          <div><strong>個人</strong><span>ログイン不要</span></div>
        </div>
      </section>

      <section className="panel auth-card">
        <div className="compact-heading">
          <p className="eyebrow">Sign in</p>
          <h2>ログイン</h2>
        </div>
        <button
          type="button"
          className="primary-button google-button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              try {
                setMessage(null);
                await signInWithGoogle();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Googleログインを開始できませんでした。");
              }
            });
          }}
        >
          <GoogleIcon />
          {isPending ? "Googleへ移動中..." : "Googleでログイン"}
        </button>
        {message ? <p className="notice-inline">{message}</p> : null}
        <p className="compact-copy">
          共有機能を使う場合のみログインが必要です。個人利用だけならトップからそのまま始められます。
        </p>
        <Link href="/" className="text-link">トップへ戻る</Link>
      </section>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.74-.07-1.45-.19-2.12H12v4.01h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.42Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.35l-3.23-2.51c-.9.6-2.04.95-3.39.95-2.6 0-4.8-1.76-5.59-4.12H3.08v2.59A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.41 13.97A6 6 0 0 1 6.1 12c0-.68.11-1.35.31-1.97V7.44H3.08A10 10 0 0 0 2 12c0 1.61.39 3.14 1.08 4.56l3.33-2.59Z" />
      <path fill="#EA4335" d="M12 5.91c1.47 0 2.79.51 3.83 1.5l2.86-2.86C16.96 2.94 14.7 2 12 2a10 10 0 0 0-8.92 5.44l3.33 2.59C7.2 7.67 9.4 5.91 12 5.91Z" />
    </svg>
  );
}
