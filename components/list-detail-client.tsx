"use client";

import Link from "next/link";
import { useEffect, useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { DEFAULT_ITEM_FORM, ITEM_SCOPE_LABELS, VISIBILITY_LABELS } from "@/lib/constants";
import {
  createItem,
  getCurrentUser,
  getListSnapshot,
  getPublicSnapshot,
  removeItem,
  toggleItemStatus,
  updateItem,
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
  const [activeTab, setActiveTab] = useState<"pending" | "purchased">("pending");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CreateItemPayload>(DEFAULT_ITEM_FORM);
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
        <h2>表示できません</h2>
      </section>
    );
  }

  return (
    <div className="page-grid detail-shell">
      {snapshot.permission === "edit" && !publicToken ? (
        <section className="panel quick-add-panel">
          <form
            className="form-panel quick-add-form"
            action={() => {
              startTransition(async () => {
                try {
                  if (!user) {
                    throw new Error("ログインが必要です。");
                  }
                  await createItem(snapshot.list.id, user, form);
                  setForm((current) => ({
                    ...DEFAULT_ITEM_FORM,
                    scope: current.scope,
                    dueDate: current.dueDate,
                    dueTime: current.dueTime,
                    remindOn: current.remindOn,
                    reminderEnabled: current.reminderEnabled,
                  }));
                  await refresh(user);
                  setMessage(null);
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "商品追加に失敗しました。");
                }
              });
            }}
          >
            <div className="quick-add-row">
              <div className="quick-add-title">
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
              </div>

              <label className="quick-add-quantity">
                数量
                <input value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
              </label>

              <button type="submit" className="primary-button quick-add-submit" disabled={isPending}>
                {isPending ? "追加中..." : "追加"}
              </button>
            </div>

            {speech.error ? <p className="notice-inline">{speech.error}</p> : null}
            {message ? <p className="notice-inline">{message}</p> : null}
          </form>
        </section>
      ) : null}

      <section className="panel detail-hero detail-hero-compact">
        <div>
          <div className="inline-badges inline-badges-tight inline-badges-scroll">
            <span className="tag">{VISIBILITY_LABELS[snapshot.list.visibility]}</span>
            <span className="tag soft">{snapshot.members.length} 人で共有</span>
            <span className="tag soft">予定日 {formatDate(snapshot.list.plannedDate)}</span>
            {snapshot.list.dailyReminderEnabled ? <span className="tag accent">毎日 {snapshot.list.dailyReminderHour}</span> : null}
          </div>
          <div className="inline-badges member-ribbon inline-badges-scroll">
            {snapshot.members.map((member) => (
              <span className="name-badge soft" key={member.id}>
                {member.name}
                {member.role === "owner" ? " / 所有者" : ""}
              </span>
            ))}
          </div>
          <h2>{snapshot.list.name}</h2>
          {snapshot.list.description ? <p className="lead-copy">{snapshot.list.description}</p> : null}
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

      <section className="panel list-section-panel">
        <div className="list-tabs" role="tablist" aria-label="買い物リスト">
          <button
            type="button"
            className={cn("list-tab", activeTab === "pending" && "list-tab-active")}
            onClick={() => setActiveTab("pending")}
            role="tab"
            aria-selected={activeTab === "pending"}
          >
            未購入
            <span>{pendingItems.length}</span>
          </button>
          <button
            type="button"
            className={cn("list-tab", activeTab === "purchased" && "list-tab-active")}
            onClick={() => setActiveTab("purchased")}
            role="tab"
            aria-selected={activeTab === "purchased"}
          >
            購入済み
            <span>{purchasedItems.length}</span>
          </button>
        </div>
        <div className="item-list item-list-stack">
          {(activeTab === "pending" ? pendingItems : purchasedItems).length === 0 ? <p className="empty-state">なし</p> : null}
          {(activeTab === "pending" ? pendingItems : purchasedItems).map((item) => (
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
              onEdit={
                snapshot.permission === "edit" && !publicToken
                  ? async (payload) => {
                      if (!user) return;
                      await updateItem(snapshot.list.id, item.id, user, payload);
                      setEditingItemId(null);
                      await refresh(user);
                    }
                  : undefined
              }
              editing={editingItemId === item.id}
              onStartEdit={() => {
                setEditingItemId(item.id);
                setEditForm({
                  title: item.title,
                  quantity: item.quantity,
                  note: item.note,
                  scope: item.scope,
                  dueDate: item.dueDate,
                  dueTime: item.dueTime,
                  remindOn: item.remindOn,
                  reminderEnabled: item.reminderEnabled,
                });
              }}
              onCancelEdit={() => setEditingItemId(null)}
              editForm={editForm}
              setEditForm={setEditForm}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function ItemRow({
  item,
  editable,
  onToggle,
  onRemove,
  onEdit,
  editing,
  onStartEdit,
  onCancelEdit,
  editForm,
  setEditForm,
}: {
  item: ShoppingItemView;
  editable: boolean;
  onToggle: () => Promise<void>;
  onRemove?: () => Promise<void>;
  onEdit?: (payload: CreateItemPayload) => Promise<void>;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  editForm: CreateItemPayload;
  setEditForm: Dispatch<SetStateAction<CreateItemPayload>>;
}) {
  const [isSaving, startSaving] = useTransition();
  const [editMessage, setEditMessage] = useState<string | null>(null);

  return (
    <article className={cn("item-row item-row-modern", item.status === "purchased" && "item-row-done", item.dueState === "today" && "item-row-today", item.dueState === "overdue" && "item-row-overdue")}>
      <div className="item-row-top">
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
            <button type="button" className="ghost-button" onClick={onStartEdit}>
              編集
            </button>
            {onRemove ? (
              <button type="button" className="ghost-button danger" onClick={() => void onRemove()}>
                削除
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {editing && onEdit ? (
        <form
          className="item-edit-form"
          action={() => {
            startSaving(async () => {
              try {
                await onEdit(editForm);
                setEditMessage(null);
              } catch (error) {
                setEditMessage(error instanceof Error ? error.message : "保存できませんでした。");
              }
            });
          }}
        >
          <div className="item-edit-grid">
            <label>
              商品名
              <input value={editForm.title} onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label>
              数量
              <input value={editForm.quantity} onChange={(event) => setEditForm((current) => ({ ...current, quantity: event.target.value }))} />
            </label>
            <label>
              登録タイプ
              <select
                value={editForm.scope}
                onChange={(event) => setEditForm((current) => ({ ...current, scope: event.target.value as CreateItemPayload["scope"] }))}
              >
                <option value="shared">共有する買い物</option>
                <option value="personal">自分の買い物</option>
              </select>
            </label>
            <label>
              買いたい日
              <input
                type="date"
                value={editForm.dueDate ?? ""}
                onChange={(event) => setEditForm((current) => ({ ...current, dueDate: event.target.value || null }))}
              />
            </label>
            <label>
              時刻
              <input
                type="time"
                value={editForm.dueTime ?? ""}
                onChange={(event) => setEditForm((current) => ({ ...current, dueTime: event.target.value || null }))}
              />
            </label>
            <label>
              リマインド日
              <input
                type="date"
                value={editForm.remindOn ?? ""}
                onChange={(event) => setEditForm((current) => ({ ...current, remindOn: event.target.value || null }))}
              />
            </label>
          </div>
          <label>
            メモ
            <input value={editForm.note} onChange={(event) => setEditForm((current) => ({ ...current, note: event.target.value }))} />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={editForm.reminderEnabled}
              onChange={(event) => setEditForm((current) => ({ ...current, reminderEnabled: event.target.checked }))}
            />
            通知する
          </label>
          <div className="item-edit-actions">
            <button type="submit" className="primary-button" disabled={isSaving}>
              {isSaving ? "保存中..." : "保存"}
            </button>
            <button type="button" className="ghost-button" onClick={onCancelEdit} disabled={isSaving}>
              閉じる
            </button>
          </div>
          {editMessage ? <p className="notice-inline">{editMessage}</p> : null}
        </form>
      ) : null}
    </article>
  );
}
