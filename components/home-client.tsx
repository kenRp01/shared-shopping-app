"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentUser, getDemoCredentials, listAccessibleLists } from "@/lib/local-store";
import type { ShoppingListOverview, UserProfile } from "@/lib/types";
import { VISIBILITY_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

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

  const dueToday = lists.reduce((sum, list) => sum + list.dueTodayCount, 0);
  const overdue = lists.reduce((sum, list) => sum + list.overdueCount, 0);

  return (
    <div className="page-grid home-shell">
      <section className="panel dashboard-hero dashboard-hero-compact">
        <div className="hero-copy">
          <p className="eyebrow">Today</p>
          <h2>{user.name}さんの買い物一覧</h2>
        </div>
        <div className="summary-strip summary-strip-tight">
          <article className="summary-block accent">
            <strong>{lists.length}</strong>
            <span>リスト</span>
          </article>
          <article className="summary-block warning">
            <strong>{overdue}</strong>
            <span>期限切れ</span>
          </article>
          <article className="summary-block neutral">
            <strong>{dueToday}</strong>
            <span>今日の買い物</span>
          </article>
        </div>
      </section>

      <section className="panel list-overview-panel">
        <div className="panel-header panel-header-tight">
          <div>
            <p className="eyebrow">My Lists</p>
            <h2>リスト</h2>
          </div>
          <Link href="/lists/new" className="primary-button">新しいリスト</Link>
        </div>
        <div className="list-overview-grid">
          {lists.map((list) => (
            <article className="list-card list-card-modern" key={list.id}>
              <div className="list-card-head">
                <div>
                  <h3>{list.name}</h3>
                  {list.description ? <p>{list.description}</p> : null}
                </div>
                <span className="tag">{VISIBILITY_LABELS[list.visibility]}</span>
              </div>
              <div className="metric-pills">
                <span className="metric-pill strong">未購入 {list.pendingCount}</span>
                <span className="metric-pill">購入済み {list.purchasedCount}</span>
                <span className="metric-pill">今日 {list.dueTodayCount}</span>
                <span className="metric-pill warning">期限切れ {list.overdueCount}</span>
                <span className="metric-pill">予定日 {formatDate(list.plannedDate)}</span>
              </div>
              <div className="inline-badges member-cluster">
                {list.memberNames.map((memberName) => (
                  <span className="name-badge soft" key={`${list.id}-${memberName}`}>{memberName}</span>
                ))}
              </div>
              <div className="card-actions">
                <Link href={`/lists/${list.id}`} className="primary-button">開く</Link>
                <Link href={`/lists/${list.id}/settings`} className="ghost-button">共有設定</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
