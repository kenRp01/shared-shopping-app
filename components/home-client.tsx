"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentUser, getDemoCredentials, listAccessibleLists } from "@/lib/local-store";
import type { ShoppingListOverview, UserProfile } from "@/lib/types";
import { VISIBILITY_LABELS } from "@/lib/constants";

export function HomeClient() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [lists, setLists] = useState<ShoppingListOverview[]>([]);
  const [demo, setDemo] = useState<Array<{ email: string; password: string; name: string }>>([]);
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  useEffect(() => {
    getCurrentUser().then(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLists(await listAccessibleLists(currentUser.id));
      } else {
        setDemo(await getDemoCredentials());
      }
    });
  }, []);

  if (!user) {
    return (
      <div className="page-grid home-shell">
        <section className="panel landing-hero landing-hero-compact">
          <div className="hero-copy">
            <p className="eyebrow">ShareShopi</p>
            <h2>共有買い物リスト</h2>
          </div>
          <div className="hero-actions">
            <Link href="/signup" className="primary-button">無料で始める</Link>
            <Link href="/login" className="ghost-button">ログイン</Link>
          </div>
          <div className="status-ribbon">
            <span>無料運用前提</span>
            <span>共有メンバー編集可</span>
            <span>公開リンクは閲覧のみ</span>
          </div>
        </section>

        <section className="panel demo-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Demo Accounts</p>
              <h2>デモ</h2>
            </div>
          </div>
          <div className="demo-list">
            {demo.map((entry) => (
              <div className="demo-row" key={entry.email}>
                <strong>{entry.name}</strong>
                <span>{entry.email}</span>
                <code>{entry.password}</code>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-grid home-shell">
      <section className="panel list-overview-panel">
        <div className="list-toolbar">
          <Link href="/lists/new" className="primary-button compact-button compact-button-accent">新しいリスト</Link>
        </div>
        <div className="list-overview-grid">
          {lists.length === 0 ? <p className="empty-state">なし</p> : null}
          {lists.map((list) => (
            <article className="list-card list-card-modern" key={list.id}>
              <div className="list-card-head">
                <h3>{list.name}</h3>
                <span className="tag">{VISIBILITY_LABELS[list.visibility]}</span>
              </div>
              <div className="metric-pills">
                <span className="metric-pill strong">未購入 {list.pendingCount}</span>
              </div>
              <div className="card-actions">
                <Link href={`/lists/${list.id}`} className="primary-button">開く</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
