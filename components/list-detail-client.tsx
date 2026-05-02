"use client";

import Link from "next/link";
import { useEffect, useState, useTransition, type Dispatch, type DragEvent, type SetStateAction } from "react";
import { DEFAULT_ITEM_FORM, DEFAULT_LIST_FORM } from "@/lib/constants";
import {
  createList,
  createItem,
  getCurrentUser,
  getListSnapshot,
  getPublicSnapshot,
  listAccessibleLists,
  removeItem,
  reorderItems,
  reorderLists,
  updateItem,
} from "@/lib/local-store";
import type { CreateItemPayload, ShoppingItemView, ShoppingListOverview, ShoppingListSnapshot, UserProfile } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

type Props = {
  listId?: string;
  publicToken?: string;
};

export function ListDetailClient({ listId, publicToken }: Props) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [snapshot, setSnapshot] = useState<ShoppingListSnapshot | null>(null);
  const [categories, setCategories] = useState<ShoppingListOverview[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<CreateItemPayload>(DEFAULT_ITEM_FORM);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CreateItemPayload>(DEFAULT_ITEM_FORM);
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showCategoryCreate, setShowCategoryCreate] = useState(false);
  const [categoryFormName, setCategoryFormName] = useState("");
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refresh(currentUser?: UserProfile | null) {
    const nextUser = currentUser ?? (await getCurrentUser());
    setUser(nextUser);
    if (nextUser) {
      setCategories(await listAccessibleLists(nextUser.id));
    } else {
      setCategories([]);
    }
    const nextSnapshot = publicToken
      ? await getPublicSnapshot(publicToken)
      : listId
        ? await getListSnapshot(listId, nextUser?.id)
        : null;
    setSnapshot(nextSnapshot);
  }

  function removeItemFromView(itemId: string) {
    setSnapshot((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.filter((item) => item.id !== itemId),
      };
    });
  }

  useEffect(() => {
    refresh();
  }, [listId, publicToken]);

  const pendingItems = snapshot?.items.filter((item) => item.status === "pending") ?? [];

  function parseQuickAddTitles(value: string) {
    return value
      .split(/[\n,、]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (!snapshot) {
    return (
      <section className="panel">
        <h2>表示できません</h2>
      </section>
    );
  }

  const activeListName = snapshot.list.name;
  const hasSharedContext = snapshot.list.visibility !== "private" || snapshot.members.some((member) => member.id !== snapshot.owner.id);

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
                  const titles = parseQuickAddTitles(form.title);
                  if (titles.length === 0) {
                    throw new Error("商品名を入力してください。");
                  }
                  await Promise.all(
                    titles.map((title) =>
                      createItem(snapshot.list.id, user, {
                        ...form,
                        title,
                      }),
                    ),
                  );
                  setForm((current) => ({
                    ...DEFAULT_ITEM_FORM,
                    title: "",
                    quantity: current.quantity,
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
                <input value={form.title} placeholder="牛乳、卵、洗剤" aria-label="商品名" onChange={(event) => setForm({ ...form, title: event.target.value })} />
              </div>

              <label className="quick-add-quantity quick-add-quantity-inline">
                <input
                  value={form.quantity}
                  aria-label="数量"
                  placeholder="1"
                  onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                />
              </label>

              <button type="submit" className="primary-button quick-add-submit" disabled={isPending}>
                {isPending ? "追加中..." : "追加"}
              </button>
            </div>
            {message ? <p className="notice-inline">{message}</p> : null}
          </form>
        </section>
      ) : null}

      <section className="panel list-section-panel">
        {categories.length ? (
          <div className="category-strip-wrap">
            <div className="category-strip" aria-label="カテゴリー切り替え">
            {categories.map((category) => (
              <div
                key={category.id}
                className={cn(
                  "category-pill-holder",
                  draggingCategoryId === category.id && "category-pill-holder-dragging",
                )}
                draggable={Boolean(user) && !publicToken}
                onDragStart={() => setDraggingCategoryId(category.id)}
                onDragEnd={() => setDraggingCategoryId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDragEnter={() => {
                  if (!draggingCategoryId || draggingCategoryId === category.id || !user) {
                    return;
                  }
                  setCategories((current) => {
                    const next = [...current];
                    const from = next.findIndex((entry) => entry.id === draggingCategoryId);
                    const to = next.findIndex((entry) => entry.id === category.id);
                    if (from < 0 || to < 0 || from === to) {
                      return current;
                    }
                    const [moved] = next.splice(from, 1);
                    next.splice(to, 0, moved);
                    return next;
                  });
                }}
                onDrop={(event: DragEvent<HTMLDivElement>) => {
                  event.preventDefault();
                  if (!user) {
                    return;
                  }
                  const orderedIds = categories.map((entry) => entry.id);
                  startTransition(async () => {
                    try {
                      await reorderLists(user, orderedIds);
                      await refresh(user);
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : "並び替えできませんでした。");
                      await refresh(user);
                    } finally {
                      setDraggingCategoryId(null);
                    }
                  });
                }}
              >
                <Link
                  href={`/lists/${category.id}`}
                  className={cn("category-pill", category.id === snapshot.list.id && "category-pill-active")}
                >
                  {category.name}
                </Link>
              </div>
            ))}
            {snapshot.permission === "edit" && !publicToken ? (
              <button
                type="button"
                className="category-add-button"
                onClick={() => setShowCategoryCreate((current) => !current)}
                aria-label="新しいリストを作成"
              >
                <PlusIcon />
              </button>
            ) : null}
            </div>
            {showCategoryCreate && snapshot.permission === "edit" && !publicToken ? (
              <form
                className="category-create-inline"
                action={() => {
                  startTransition(async () => {
                    try {
                      if (!user) {
                        throw new Error("ログインが必要です。");
                      }
                      const created = await createList(user, {
                        ...DEFAULT_LIST_FORM,
                        name: categoryFormName.trim() || "マイリスト",
                        plannedDate: null,
                        visibility: "private",
                      });
                      setCategoryFormName("");
                      setShowCategoryCreate(false);
                      await refresh(user);
                      setMessage(null);
                      window.location.href = `/lists/${created.id}`;
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : "リストを作成できませんでした。");
                    }
                  });
                }}
              >
                <input
                  value={categoryFormName}
                  placeholder="新しいリスト"
                  onChange={(event) => setCategoryFormName(event.target.value)}
                />
                <button type="submit" className="primary-button compact-button" disabled={isPending}>
                  作成
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
        <div className="detail-inline-head detail-inline-head-compact">
          {publicToken ? null : (
            <Link
              href={`/lists/${snapshot.list.id}/settings`}
              className="settings-chip"
              aria-label={`${activeListName} の設定`}
            >
              <GearIcon />
              <span>設定</span>
            </Link>
          )}
        </div>
        <div className="item-list item-list-stack">
          {pendingItems.length === 0 ? <p className="empty-state">なし</p> : null}
          {pendingItems.map((item) => (
            <ItemRow
              item={item}
              key={item.id}
              editable={snapshot.permission === "edit" && !publicToken}
              showSharedContext={hasSharedContext}
              dragging={draggingItemId === item.id}
              onDragStart={() => setDraggingItemId(item.id)}
              onDragEnd={() => setDraggingItemId(null)}
              onDragEnter={() => {
                if (!draggingItemId || draggingItemId === item.id || !user) {
                  return;
                }
                setSnapshot((current) => {
                  if (!current) {
                    return current;
                  }
                  const visiblePendingIds = new Set(pendingItems.map((entry) => entry.id));
                  const pending = current.items.filter((entry) => visiblePendingIds.has(entry.id));
                  const others = current.items.filter((entry) => !visiblePendingIds.has(entry.id));
                  const nextPending = [...pending];
                  const from = nextPending.findIndex((entry) => entry.id === draggingItemId);
                  const to = nextPending.findIndex((entry) => entry.id === item.id);
                  if (from < 0 || to < 0 || from === to) {
                    return current;
                  }
                  const [moved] = nextPending.splice(from, 1);
                  nextPending.splice(to, 0, moved);
                  return {
                    ...current,
                    items: [...nextPending, ...others],
                  };
                });
              }}
              onDrop={() => {
                if (!user) {
                  return;
                }
                const orderedIds = pendingItems.map((entry) => entry.id);
                startTransition(async () => {
                  try {
                    await reorderItems(snapshot.list.id, user, orderedIds);
                    await refresh(user);
                    setMessage(null);
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "並び替えできませんでした。");
                    await refresh(user);
                  } finally {
                    setDraggingItemId(null);
                  }
                });
              }}
              onToggle={async () => {
                if (!user) return;
                removeItemFromView(item.id);
                try {
                  await removeItem(snapshot.list.id, item.id, user);
                  await refresh(user);
                } catch (error) {
                  await refresh(user);
                  setMessage(error instanceof Error ? error.message : "更新できませんでした。");
                }
              }}
              onEdit={
                    snapshot.permission === "edit" && !publicToken
                      ? async (payload) => {
                          if (!user) return;
                          let targetCategoryId = editCategoryId || snapshot.list.id;
                          if (newCategoryName.trim()) {
                            const nextList = await createList(user, {
                              ...DEFAULT_LIST_FORM,
                              name: newCategoryName.trim(),
                              plannedDate: null,
                            });
                            targetCategoryId = nextList.id;
                          }
                          await updateItem(snapshot.list.id, item.id, user, payload, targetCategoryId);
                          setEditingItemId(null);
                          setNewCategoryName("");
                          await refresh(user);
                        }
                      : undefined
              }
              editing={editingItemId === item.id}
              onStartEdit={() => {
                setEditingItemId(item.id);
                setEditCategoryId(snapshot.list.id);
                setNewCategoryName("");
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
              categories={categories}
              editCategoryId={editCategoryId}
              setEditCategoryId={setEditCategoryId}
              newCategoryName={newCategoryName}
              setNewCategoryName={setNewCategoryName}
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
  showSharedContext,
  dragging,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDrop,
  onToggle,
  onEdit,
  editing,
  onStartEdit,
  onCancelEdit,
  editForm,
  setEditForm,
  categories,
  editCategoryId,
  setEditCategoryId,
  newCategoryName,
  setNewCategoryName,
}: {
  item: ShoppingItemView;
  editable: boolean;
  showSharedContext: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragEnter: () => void;
  onDrop: () => void;
  onToggle: () => Promise<void>;
  onEdit?: (payload: CreateItemPayload) => Promise<void>;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  editForm: CreateItemPayload;
  setEditForm: Dispatch<SetStateAction<CreateItemPayload>>;
  categories: ShoppingListOverview[];
  editCategoryId: string;
  setEditCategoryId: Dispatch<SetStateAction<string>>;
  newCategoryName: string;
  setNewCategoryName: Dispatch<SetStateAction<string>>;
}) {
  const [isSaving, startSaving] = useTransition();
  const [editMessage, setEditMessage] = useState<string | null>(null);

  return (
    <article
      className={cn(
        "item-row item-row-modern",
        showSharedContext && (item.scope === "shared" ? "item-row-shared" : "item-row-personal"),
        dragging && "item-row-dragging",
        item.status === "purchased" && "item-row-done",
        item.dueState === "today" && "item-row-today",
        item.dueState === "overdue" && "item-row-overdue",
      )}
      draggable={editable && !editing}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={onDragEnter}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
    >
      <div className="item-row-top">
        {editable ? (
          <label className="item-check">
            <input
              type="checkbox"
              checked={item.status === "purchased"}
              onChange={() => void onToggle()}
              aria-label={`${item.title} を購入済みにして一覧から外す`}
            />
            <span className="item-check-ui" aria-hidden="true" />
          </label>
        ) : item.status === "purchased" ? (
          <span className="item-check read-only" aria-hidden="true">
            <span className="item-check-ui checked" />
          </span>
        ) : null}
        <button
          type="button"
          className="item-main item-main-button"
          onClick={editable && !editing ? onStartEdit : undefined}
          disabled={!editable || editing}
          aria-label={editable ? `${item.title} を編集` : item.title}
        >
          <div className="item-main-head">
            <div className="item-title">
              <strong>{item.title}</strong>
            </div>
            <span className="item-quantity">{item.quantity}</span>
          </div>
          {item.note ? <p>{item.note}</p> : null}
          {showSharedContext || item.dueDate ? (
            <div className="item-meta-line">
              {showSharedContext ? <span className="item-meta-text">{item.createdByName}</span> : null}
              {item.dueDate ? <span className="item-meta-text">{formatDate(item.dueDate)}</span> : null}
            </div>
          ) : null}
        </button>
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
              カテゴリー
              <select value={editCategoryId} onChange={(event) => setEditCategoryId(event.target.value)}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <label>
              新しいカテゴリー
              <input value={newCategoryName} placeholder="必要なときだけ入力" onChange={(event) => setNewCategoryName(event.target.value)} />
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

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.75a2.25 2.25 0 0 1 2.2 1.77l.14.62a1.05 1.05 0 0 0 .89.8l.64.09a2.25 2.25 0 0 1 1.53 3.56l-.38.53a1.05 1.05 0 0 0 0 1.22l.38.53a2.25 2.25 0 0 1-1.53 3.56l-.64.09a1.05 1.05 0 0 0-.89.8l-.14.62a2.25 2.25 0 0 1-4.4 0l-.14-.62a1.05 1.05 0 0 0-.89-.8l-.64-.09a2.25 2.25 0 0 1-1.53-3.56l.38-.53a1.05 1.05 0 0 0 0-1.22l-.38-.53A2.25 2.25 0 0 1 8.75 7l.64-.09a1.05 1.05 0 0 0 .89-.8l.14-.62A2.25 2.25 0 0 1 12 3.75Z" />
      <circle cx="12" cy="12" r="3.15" />
    </svg>
  );
}
