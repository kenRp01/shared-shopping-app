"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { DEFAULT_LIST_FORM } from "@/lib/constants";
import { continueAsGuest, createList, getCurrentUser, getDemoCredentials, listAccessibleLists } from "@/lib/local-store";
import type { ShoppingListOverview, UserProfile } from "@/lib/types";

export function HomeClient() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [lists, setLists] = useState<ShoppingListOverview[]>([]);
  const [demo, setDemo] = useState<Array<{ email: string; password: string; name: string }>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                startTransition(async () => {
                  try {
                    const result = await continueAsGuest();
                    router.push(`/lists/${result.listId}`);
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "開始できませんでした。");
                  }
                });
              }}
              disabled={isPending}
            >
              {isPending ? "準備中..." : "ひとりで使う"}
            </button>
            <Link href="/signup" className="primary-button">新規登録</Link>
            <Link href="/login" className="ghost-button">ログイン</Link>
          </div>
          {message ? <p className="notice-inline">{message}</p> : null}
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
        {lists.length === 0 ? (
          <div className="card-actions">
            <button
              type="button"
              className="primary-button compact-button compact-button-accent"
              onClick={() => {
                startTransition(async () => {
                  try {
                    if (!user) {
                      throw new Error("開始できませんでした。");
                    }
                    const list = await createList(user, {
                      ...DEFAULT_LIST_FORM,
                      name: "買い物",
                      plannedDate: null,
                      visibility: "private",
                    });
                    router.push(`/lists/${list.id}`);
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "カテゴリーを作成できませんでした。");
                  }
                });
              }}
              disabled={isPending}
            >
              {isPending ? "作成中..." : "最初のカテゴリー"}
            </button>
          </div>
        ) : null}
        {message ? <p className="notice-inline">{message}</p> : null}
        <div className="list-overview-grid">
          {lists.length === 0 ? <p className="empty-state">商品を追加してカテゴリーを作ってください</p> : null}
          {lists.map((list) => (
            <article className="list-card list-card-modern" key={list.id}>
              <Link href={`/lists/${list.id}`} className="list-card-link" aria-label={`${list.name} を開く`}>
                <div className="list-card-head">
                  <h3>{list.name}</h3>
                  <span className="list-card-chevron" aria-hidden="true">›</span>
                </div>
                <div className="list-card-subline">
                  {list.pendingCount > 0 ? <span>{list.pendingCount}件</span> : null}
                  {list.pendingCount === 0 ? <span>空</span> : null}
                </div>
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
