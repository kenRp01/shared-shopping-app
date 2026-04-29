"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { DEFAULT_LIST_FORM } from "@/lib/constants";
import { createList, getCurrentUser, getDemoCredentials, listAccessibleLists } from "@/lib/local-store";
import type { ShoppingListOverview, UserProfile } from "@/lib/types";
import { VISIBILITY_LABELS } from "@/lib/constants";

export function HomeClient() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [lists, setLists] = useState<ShoppingListOverview[]>([]);
  const [demo, setDemo] = useState<Array<{ email: string; password: string; name: string }>>([]);
  const [newListName, setNewListName] = useState("");
  const [plannedDate, setPlannedDate] = useState(DEFAULT_LIST_FORM.plannedDate ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
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
        <form
          className="list-create-inline"
          action={() => {
            startTransition(async () => {
              try {
                if (!user) {
                  throw new Error("ログインしてください");
                }
                const list = await createList(user, {
                  ...DEFAULT_LIST_FORM,
                  name: newListName,
                  plannedDate: plannedDate || null,
                });
                router.push(`/lists/${list.id}`);
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "作成できませんでした。");
              }
            });
          }}
        >
          <input
            value={newListName}
            placeholder="新しいリスト"
            aria-label="新しいリスト"
            maxLength={50}
            onChange={(event) => setNewListName(event.target.value)}
          />
          <input
            type="date"
            value={plannedDate}
            aria-label="買い物予定日"
            onChange={(event) => setPlannedDate(event.target.value)}
          />
          <button type="submit" className="primary-button compact-button compact-button-accent" disabled={isPending}>
            {isPending ? "作成中..." : "作成"}
          </button>
        </form>
        {message ? <p className="notice-inline">{message}</p> : null}
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
