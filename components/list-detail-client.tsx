"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { DEFAULT_ITEM_FORM, ITEM_SCOPE_LABELS, VISIBILITY_LABELS } from "@/lib/constants";
import {
  createItem,
  getCurrentUser,
  getListSnapshot,
  getPublicSnapshot,
  removeItem,
  toggleItemStatus,
} from "@/lib/local-store";
import { useSpeechInput } from "@/lib/use-speech-input";
import type { CreateItemPayload, ShoppingItemView, ShoppingListSnapshot, UserProfile } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

type Props = {
  listId?: string;
  publicToken?: string;
};

export function ListDetailClient({ listId, publicToken }: Props) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [snapshot, setSnapshot] = useState<ShoppingListSnapshot | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<CreateItemPayload>(DEFAULT_ITEM_FORM);
  const [isPending, startTransition] = useTransition();
  const speech = useSpeechInput((transcript) => {
    setForm((current) => ({
      ...current,
      title: current.title ? `${current.title} ${transcript}`.trim() : transcript,
    }));
    setMessage(null);
  });

  async function refresh(currentUser?: UserProfile | null) {
    const nextUser = currentUser ?? (await getCurrentUser());
    setUser(nextUser);
    const nextSnapshot = publicToken
      ? await getPublicSnapshot(publicToken)
      : listId
        ? await getListSnapshot(listId, nextUser?.id)
        : null;
    setSnapshot(nextSnapshot);
  }

  useEffect(() => {
    refresh();
  }, [listId, publicToken]);

  const pendingItems = snapshot?.items.filter((item) => item.status === "pending") ?? [];
  const purchasedItems = snapshot?.items.filter((item) => item.status === "purchased") ?? [];
  const dueToday = pendingItems.filter((item) => item.dueState === "today");
  const overdue = pendingItems.filter((item) => item.dueState === "overdue");

  if (!snapshot) {
    return (
      <section className="panel">
        <p className="eyebrow">Unavailable</p>
        <h2>リストが見つからないか、閲覧権限がありません</h2>
      </section>
    );
  }

  return (
    <div className="page-grid detail-shell">
      <section className="panel detail-hero detail-hero-compact">
        <div>
          <div className="inline-badges inline-badges-tight">
            <span className="tag">{VISIBILITY_LABELS[snapshot.list.visibility]}</span>
            <span className="tag soft">{snapshot.members.length} 人で共有</span>
            <span className="tag soft">予定日 {formatDate(snapshot.list.plannedDate)}</span>
            {snapshot.list.dailyReminderEnabled ? <span className="tag accent">毎日 {snapshot.list.dailyReminderHour}</span> : null}
          </div>
          <div className="inline-badges member-ribbon">
            {snapshot.members.map((member) => (
              <span className="name-badge soft" key={member.id}>
                {member.name}
                {member.role === "owner" ? " / 所有者" : ""}
              </span>
            ))}
          </div>
          <h2>{snapshot.list.name}</h2>
          <p className="lead-copy">{snapshot.list.description || "共有する買い物をまとめるリストです。"}</p>
        </div>
        {publicToken ? null : (
          <div className="card-actions">
            <Link href={`/lists/${snapshot.list.id}/settings`} className="ghost-button">共有設定</Link>
            {snapshot.list.publicToken ? (
              <Link href={`/public/${snapshot.list.publicToken}`} className="ghost-button">公開ページ</Link>
            ) : null}
          </div>
        )}
      </section>

      <section className="highlight-grid highlight-grid-compact">
        <article className="summary-block accent">
          <strong>{dueToday.length}</strong>
          <span>今日の買い物</span>
        </article>
        <article className="summary-block warning">
          <strong>{overdue.length}</strong>
          <span>期限切れ</span>
        </article>
        <article className="summary-block neutral">
          <strong>{purchasedItems.length}</strong>
          <span>購入済み</span>
        </article>
      </section>

      <div className="split-layout">
        <div className="section-stack">
          <section className="panel list-section-panel">
            <div className="panel-header panel-header-tight">
              <div>
                <p className="eyebrow">Pending</p>
                <h2>未購入</h2>
              </div>
            </div>
            <div className="item-list item-list-stack">
              {pendingItems.length === 0 ? <p className="empty-state">未購入の商品はありません。</p> : null}
              {pendingItems.map((item) => (
                <ItemRow
                  item={item}
                  key={item.id}
                  editable={snapshot.permission === "edit" && !publicToken}
                  onToggle={async () => {
                    if (!user) return;
                    await toggleItemStatus(snapshot.list.id, item.id, user);
                    await refresh(user);
                  }}
                  onRemove={async () => {
                    if (!user) return;
                    await removeItem(snapshot.list.id, item.id, user);
                    await refresh(user);
                  }}
                />
              ))}
            </div>
          </section>

          <section className="panel list-section-panel">
            <div className="panel-header panel-header-tight">
              <div>
                <p className="eyebrow">Purchased</p>
                <h2>購入済み</h2>
              </div>
            </div>
            <div className="item-list item-list-stack">
              {purchasedItems.length === 0 ? <p className="empty-state">まだ購入済みの商品はありません。</p> : null}
              {purchasedItems.map((item) => (
                <ItemRow
                  item={item}
                  key={item.id}
                  editable={snapshot.permission === "edit" && !publicToken}
                  onToggle={async () => {
                    if (!user) return;
                    await toggleItemStatus(snapshot.list.id, item.id, user);
                    await refresh(user);
                  }}
                  onRemove={async () => {
                    if (!user) return;
                    await removeItem(snapshot.list.id, item.id, user);
                    await refresh(user);
                  }}
                />
              ))}
            </div>
          </section>
        </div>

        {snapshot.permission === "edit" && !publicToken ? (
          <aside className="panel form-panel aside-panel">
            <form
              className="form-panel"
              action={() => {
                startTransition(async () => {
                  try {
                    if (!user) {
                      throw new Error("ログインが必要です。");
                    }
                    await createItem(snapshot.list.id, user, form);
                    setForm(DEFAULT_ITEM_FORM);
                    await refresh(user);
                    setMessage(null);
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "商品追加に失敗しました。");
                  }
                });
              }}
            >
              <div className="compact-heading">
                <p className="eyebrow">Quick Add</p>
                <h2>商品を追加</h2>
              </div>
              <label>
                商品名
                <div className="input-with-action">
                  <input value={form.title} placeholder="牛乳、卵、洗剤" onChange={(event) => setForm({ ...form, title: event.target.value })} />
                  {speech.isSupported ? (
                    <button
                      type="button"
                      className={cn("voice-button", speech.isListening && "voice-button-live")}
                      onClick={() => {
                        if (speech.isListening) {
                          speech.stopListening();
                          return;
                        }
                        speech.startListening();
                      }}
                      aria-label={speech.isListening ? "音声入力を停止" : "音声入力を開始"}
                    >
                      {speech.isListening ? "録音中" : "音声"}
                    </button>
                  ) : null}
                </div>
              </label>
              {speech.isSupported ? <p className="field-hint">マイクを押して商品名を話すと、そのまま入力できます。</p> : null}
              <div className="field-grid field-grid-compact">
                <label>
                  数量
                  <input value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
                </label>
                <label>
                  登録タイプ
                  <select value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value as CreateItemPayload["scope"] })}>
                    <option value="shared">共有する買い物</option>
                    <option value="personal">自分の買い物</option>
                  </select>
                </label>
              </div>
              <div className="field-grid field-grid-compact">
                <label>
                  買いたい日
                  <input type="date" value={form.dueDate ?? ""} onChange={(event) => setForm({ ...form, dueDate: event.target.value || null })} />
                </label>
                <label>
                  時刻
                  <input type="time" value={form.dueTime ?? ""} onChange={(event) => setForm({ ...form, dueTime: event.target.value || null })} />
                </label>
              </div>
              <label>
                リマインド日
                <input type="date" value={form.remindOn ?? ""} onChange={(event) => setForm({ ...form, remindOn: event.target.value || null })} />
              </label>
              <label>
                メモ
                <input value={form.note} placeholder="ブランドや売り場メモ" onChange={(event) => setForm({ ...form, note: event.target.value })} />
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.reminderEnabled}
                  onChange={(event) => setForm({ ...form, reminderEnabled: event.target.checked })}
                />
                この商品を日次リマインド対象にする
              </label>
              {speech.error ? <p className="notice-inline">{speech.error}</p> : null}
              {message ? <p className="notice-inline">{message}</p> : null}
              <button type="submit" className="primary-button" disabled={isPending}>
                {isPending ? "追加中..." : "商品を追加"}
              </button>
            </form>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function ItemRow({
  item,
  editable,
  onToggle,
  onRemove,
}: {
  item: ShoppingItemView;
  editable: boolean;
  onToggle: () => Promise<void>;
  onRemove?: () => Promise<void>;
}) {
  return (
    <article className={cn("item-row item-row-modern", item.status === "purchased" && "item-row-done", item.dueState === "today" && "item-row-today", item.dueState === "overdue" && "item-row-overdue")}>
      {editable ? (
        <label className="item-check">
          <input
            type="checkbox"
            checked={item.status === "purchased"}
            onChange={() => void onToggle()}
            aria-label={item.status === "pending" ? `${item.title} を購入済みにする` : `${item.title} を未購入に戻す`}
          />
          <span className="item-check-ui" aria-hidden="true" />
        </label>
      ) : item.status === "purchased" ? (
        <span className="item-check read-only" aria-hidden="true">
          <span className="item-check-ui checked" />
        </span>
      ) : null}
      <div className="item-main">
        <div className="item-title">
          <strong>{item.title}</strong>
          <span>{item.quantity}</span>
        </div>
        {item.note ? <p>{item.note}</p> : null}
        <div className="inline-badges inline-badges-tight">
          <span className={`tag ${item.scope === "personal" ? "" : "soft"}`}>{ITEM_SCOPE_LABELS[item.scope]}</span>
          <span className="name-badge">{item.createdByName}</span>
          {item.purchasedByName ? <span className="name-badge soft">購入 {item.purchasedByName}</span> : null}
          <span className="tag soft">{formatDate(item.dueDate)}</span>
          {item.reminderEnabled ? <span className="tag accent">通知 {formatDate(item.remindOn ?? item.dueDate)}</span> : null}
        </div>
      </div>
      {editable ? (
        <div className="item-actions">
          {onRemove ? (
            <button type="button" className="ghost-button danger" onClick={() => void onRemove()}>
              削除
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
