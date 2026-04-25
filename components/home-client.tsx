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
      <div className="page-grid">
        <section className="panel landing-hero">
          <div>
            <p className="eyebrow">Simple Shared Shopping</p>
            <h2>誰が入れたか、何が今日必要かを一目で分かる買い物アプリ</h2>
            <p className="lead-copy">
              同じリストを複数人で共有し、商品ごとの期限と追加者を見ながら、公開リンクでも確認できる構成です。
            </p>
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

        <section className="card-grid">
          <article className="panel feature-panel">
            <p className="eyebrow">Visual First</p>
            <h3>状態が色で見える</h3>
            <p>今日が期限、期限切れ、購入済みを色分けして、見落としを減らします。</p>
          </article>
          <article className="panel feature-panel">
            <p className="eyebrow">Shared Context</p>
            <h3>追加者がすぐ分かる</h3>
            <p>各商品に名前バッジが付き、誰が入れたか、誰が買ったかをその場で確認できます。</p>
          </article>
          <article className="panel feature-panel">
            <p className="eyebrow">Cloud Ready</p>
            <h3>無料構成を想定</h3>
            <p>{configured ? "Supabase 環境変数を検出しています。クラウド連携へ進めます。" : "ローカルデモで動作しつつ、Supabase/Resend連携用の設定も含めています。"}</p>
          </article>
        </section>

        <section className="panel demo-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Demo Accounts</p>
              <h2>まずは共有の動きを試せます</h2>
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
    <div className="page-grid">
      <section className="panel dashboard-hero">
        <div>
          <p className="eyebrow">Welcome</p>
          <h2>{user.name}さんの共有リスト</h2>
          <p className="lead-copy">今日必要なもの、期限切れ、共有状態を上から順に見られるようにしています。</p>
        </div>
        <div className="summary-strip">
          <article className="summary-block accent">
            <strong>{lists.length}</strong>
            <span>参加中のリスト</span>
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

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">My Lists</p>
            <h2>リスト一覧</h2>
          </div>
          <Link href="/lists/new" className="primary-button">新しいリスト</Link>
        </div>
        <div className="card-grid">
          {lists.map((list) => (
            <article className="list-card" key={list.id}>
              <div className="list-card-head">
                <div>
                  <h3>{list.name}</h3>
                  <p>{list.description}</p>
                </div>
                <span className="tag">{VISIBILITY_LABELS[list.visibility]}</span>
              </div>
              <div className="metric-row">
                <span>{list.pendingCount} 件が未購入</span>
                <span>{list.purchasedCount} 件が購入済み</span>
              </div>
              <div className="metric-row">
                <span>今日 {list.dueTodayCount}</span>
                <span>期限切れ {list.overdueCount}</span>
                <span>{list.memberCount} 人で共有</span>
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
