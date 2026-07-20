"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type Dispatch, type DragEvent, type SetStateAction } from "react";
import { FullScreenAppLoader } from "@/components/app-loader";
import { DEFAULT_ITEM_FORM, DEFAULT_LIST_FORM } from "@/lib/constants";
import {
  createList,
  createDefaultLists,
  createItem,
  continueAsGuest,
  getCurrentUser,
  getListSnapshotBundle,
  getPublicSnapshot,
  listAccessibleLists,
  removeItem,
  reorderItems,
  reorderLists,
  updateItem,
} from "@/lib/local-store";
import type { CreateItemPayload, ShoppingItem, ShoppingItemView, ShoppingList, ShoppingListOverview, ShoppingListSnapshot, UserProfile } from "@/lib/types";
import { cn, formatDate, formatRelativeDue, makeId, todayKey } from "@/lib/utils";

type Props = {
  listId?: string;
  publicToken?: string;
};

type DetailCacheEntry = {
  snapshot: ShoppingListSnapshot;
  categories: ShoppingListOverview[];
  cachedAt: number;
};

type SnapshotBundle = {
  snapshot: ShoppingListSnapshot | null;
  categories: ShoppingListOverview[] | null;
};

const DETAIL_CACHE_TTL_MS = 1000 * 60 * 3;
const detailCache = new Map<string, DetailCacheEntry>();
const detailRequests = new Map<string, Promise<SnapshotBundle>>();
const INITIAL_CACHE_KEY = "shareshopi:initial-list";
const SETTINGS_CACHE_KEY = "shareshopi:settings-list";

type InitialListCache = {
  user: UserProfile;
  snapshot: ShoppingListSnapshot;
  categories: ShoppingListOverview[];
  cachedAt: number;
};

function detailCacheKey(userId: string, listId: string) {
  return `${userId}:${listId}`;
}

function consumeInitialListCache(listId?: string): InitialListCache | null {
  if (typeof window === "undefined" || !listId) {
    return null;
  }

  const raw = sessionStorage.getItem(INITIAL_CACHE_KEY);
  if (!raw) {
    return null;
  }

  sessionStorage.removeItem(INITIAL_CACHE_KEY);
  let parsed: InitialListCache;
  try {
    parsed = JSON.parse(raw) as InitialListCache;
  } catch {
    return null;
  }
  if (parsed.snapshot?.list.id !== listId || Date.now() - parsed.cachedAt > DETAIL_CACHE_TTL_MS) {
    return null;
  }

  detailCache.set(detailCacheKey(parsed.user.id, listId), {
    snapshot: parsed.snapshot,
    categories: parsed.categories,
    cachedAt: parsed.cachedAt,
  });
  return parsed;
}

function loadSnapshotBundle(listId: string, userId?: string | null) {
  const requestKey = `${userId ?? "guest"}:${listId}`;
  const existing = detailRequests.get(requestKey);
  if (existing) {
    return existing;
  }

  const request = getListSnapshotBundle(listId, userId).finally(() => {
    detailRequests.delete(requestKey);
  });
  detailRequests.set(requestKey, request);
  return request;
}

export function ListDetailClient({ listId, publicToken }: Props) {
  const router = useRouter();
  const [initialCache] = useState(() => consumeInitialListCache(listId));
  const [activeListId, setActiveListId] = useState(listId);
  const [user, setUser] = useState<UserProfile | null>(initialCache?.user ?? null);
  const [snapshot, setSnapshot] = useState<ShoppingListSnapshot | null>(initialCache?.snapshot ?? null);
  const [categories, setCategories] = useState<ShoppingListOverview[]>(initialCache?.categories ?? []);
  const [message, setMessage] = useState<string | null>(null);
  const [isResolvingList, setIsResolvingList] = useState(!initialCache?.snapshot);
  const [form, setForm] = useState<CreateItemPayload>(DEFAULT_ITEM_FORM);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CreateItemPayload>(DEFAULT_ITEM_FORM);
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [showCategoryCreate, setShowCategoryCreate] = useState(false);
  const [categoryFormName, setCategoryFormName] = useState("");
  const [optimisticListId, setOptimisticListId] = useState<string | null>(null);
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const categoryRailRef = useRef<HTMLDivElement | null>(null);
  const categoryCardRefs = useRef(new Map<string, HTMLDivElement>());
  const categoryScrollFrameRef = useRef<number | null>(null);
  const activeListIdRef = useRef(activeListId);
  const shouldScrollToActiveRef = useRef(false);
  const locallyRemovedItemsRef = useRef(new Map<string, string>());
  const [, startTransition] = useTransition();

  function filterLocallyRemovedItems(nextSnapshot: ShoppingListSnapshot | null) {
    if (!nextSnapshot || locallyRemovedItemsRef.current.size === 0) {
      return nextSnapshot;
    }

    const items = nextSnapshot.items.filter((item) => !locallyRemovedItemsRef.current.has(item.id));
    if (items.length === nextSnapshot.items.length) {
      return nextSnapshot;
    }

    return {
      ...nextSnapshot,
      items,
    };
  }

  async function refresh(currentUser?: UserProfile | null, options: { useCache?: boolean; listId?: string | null } = {}) {
    const targetListId = options.listId ?? activeListId;
    if (!snapshot) {
      setIsResolvingList(true);
    }
    try {
      const nextUser = currentUser ?? (await getCurrentUser());
      setUser(nextUser);
      const cacheKey = nextUser && targetListId && !publicToken ? detailCacheKey(nextUser.id, targetListId) : null;
      const cached = cacheKey ? detailCache.get(cacheKey) : null;
      if (options.useCache !== false && cached && Date.now() - cached.cachedAt < DETAIL_CACHE_TTL_MS) {
        setSnapshot(filterLocallyRemovedItems(cached.snapshot));
        setCategories(cached.categories);
        setOptimisticListId(null);
        setIsResolvingList(false);
        window.setTimeout(() => {
          refresh(nextUser, { useCache: false, listId: targetListId });
        }, 0);
        return;
      }

      let nextCategories: ShoppingListOverview[] = [];
      let nextSnapshot: ShoppingListSnapshot | null = null;
      if (publicToken) {
        nextSnapshot = await getPublicSnapshot(publicToken);
      } else if (targetListId) {
        const bundle = await loadSnapshotBundle(targetListId, nextUser?.id);
        nextSnapshot = bundle.snapshot;
        if (bundle.categories) {
          nextCategories = bundle.categories;
        } else if (nextUser) {
          nextCategories = await listAccessibleLists(nextUser.id);
        }
      } else if (nextUser) {
        nextCategories = await listAccessibleLists(nextUser.id);
      }

      nextSnapshot = filterLocallyRemovedItems(nextSnapshot);
      setCategories(nextCategories);

      if (!nextSnapshot && targetListId && !publicToken) {
        if (nextUser) {
          const fallbackList = nextCategories.find((list) => list.id !== targetListId) ?? nextCategories[0];
          if (fallbackList) {
            router.replace(`/lists/${fallbackList.id}`);
            return;
          }

          const [starter] = await createDefaultLists(nextUser);
          router.replace(`/lists/${starter.id}`);
          return;
        }

        const guest = await continueAsGuest();
        router.replace(`/lists/${guest.listId}`);
        return;
      }

      setSnapshot(nextSnapshot);
      if (cacheKey && nextSnapshot) {
        detailCache.set(cacheKey, {
          snapshot: nextSnapshot,
          categories: nextCategories,
          cachedAt: Date.now(),
        });
      }
      setOptimisticListId(null);
    } catch (error) {
      if (!publicToken) {
        const guest = await continueAsGuest();
        router.replace(`/lists/${guest.listId}`);
        return;
      }
      setSnapshot(null);
      setOptimisticListId(null);
    } finally {
      setIsResolvingList(false);
    }
  }

  function removeItemFromView(itemId: string, itemListId: string) {
    locallyRemovedItemsRef.current.set(itemId, itemListId);
    detailRequests.delete(`${user?.id ?? "guest"}:${itemListId}`);
    updateItemsInView((items) => items.filter((item) => item.id !== itemId));
    updateCategoriesInView((current) =>
      current.map((category) =>
        category.id === itemListId
          ? { ...category, pendingCount: Math.max(0, category.pendingCount - 1) }
          : category,
      ),
    );
  }

  function toItemViewFromItem(item: ShoppingItem, fallbackUser: UserProfile): ShoppingItemView {
    const displayName = fallbackUser.name || fallbackUser.email.split("@")[0] || "ユーザー";
    return {
      ...item,
      createdByName: displayName,
      updatedByName: displayName,
      purchasedByName: null,
      dueState: formatRelativeDue(item.dueDate, todayKey()),
      reminderState: formatRelativeDue(item.remindOn ?? item.dueDate, todayKey()),
    };
  }

  function makeOptimisticItem(title: string, payload: CreateItemPayload, viewer: UserProfile, index: number): ShoppingItemView {
    const now = new Date().toISOString();
    return toItemViewFromItem(
      {
        id: makeId("item_pending"),
        listId: snapshot?.list.id ?? activeListId ?? "",
        sortOrder: pendingItems.length + index,
        title,
        quantity: payload.quantity,
        note: payload.note,
        status: "pending",
        scope: payload.scope,
        dueDate: payload.dueDate,
        dueTime: payload.dueTime,
        remindOn: payload.remindOn,
        reminderEnabled: payload.reminderEnabled,
        createdByUserId: viewer.id,
        updatedByUserId: viewer.id,
        purchasedByUserId: null,
        createdAt: now,
        updatedAt: now,
      },
      viewer,
    );
  }

  function updateItemsInView(updater: (items: ShoppingItemView[]) => ShoppingItemView[]) {
    setSnapshot((current) => {
      if (!current) return current;
      const next = {
        ...current,
        items: updater(current.items),
      };
      if (user && activeListId) {
        const cacheKey = detailCacheKey(user.id, activeListId);
        const cached = detailCache.get(cacheKey);
        detailCache.set(cacheKey, {
          snapshot: next,
          categories: cached?.categories ?? categories,
          cachedAt: Date.now(),
        });
      }
      return next;
    });
  }

  function toOverviewFromList(list: ShoppingList, viewer: UserProfile, pendingCount = 0): ShoppingListOverview {
    return {
      ...list,
      ownerName: viewer.name,
      memberNames: [viewer.name],
      memberCount: 1,
      pendingCount,
      purchasedCount: 0,
      dueTodayCount: 0,
      overdueCount: 0,
      reminderTodayCount: 0,
      viewerRole: "owner",
    };
  }

  function makeOptimisticList(name: string, viewer: UserProfile): ShoppingList {
    const now = new Date().toISOString();
    return {
      id: makeId("list_pending"),
      name,
      sortOrder: categories.length,
      description: "",
      plannedDate: null,
      visibility: "private",
      ownerUserId: viewer.id,
      publicToken: null,
      dailyReminderEnabled: DEFAULT_LIST_FORM.dailyReminderEnabled,
      dailyReminderHour: DEFAULT_LIST_FORM.dailyReminderHour,
      createdAt: now,
      updatedAt: now,
    };
  }

  function updateCategoryCache(nextCategories: ShoppingListOverview[], targetSnapshot = snapshot) {
    if (!user || !activeListId || !targetSnapshot) {
      return;
    }
    detailCache.set(detailCacheKey(user.id, activeListId), {
      snapshot: targetSnapshot,
      categories: nextCategories,
      cachedAt: Date.now(),
    });
  }

  function updateCategoriesInView(updater: (current: ShoppingListOverview[]) => ShoppingListOverview[]) {
    setCategories((current) => {
      const next = updater(current);
      updateCategoryCache(next);
      return next;
    });
  }

  function cacheSettingsView() {
    if (!user || !snapshot || activeCategoryId !== snapshot.list.id) {
      return;
    }

    const settingsSnapshot: ShoppingListSnapshot = {
      ...snapshot,
      items: [],
    };

    sessionStorage.setItem(
      SETTINGS_CACHE_KEY,
      JSON.stringify({
        user,
        snapshot: settingsSnapshot,
        categories,
        cachedAt: Date.now(),
      }),
    );
    sessionStorage.setItem(
      INITIAL_CACHE_KEY,
      JSON.stringify({
        user,
        snapshot,
        categories,
        cachedAt: Date.now(),
      }),
    );
  }

  function switchList(
    nextListId: string,
    options: { history?: "push" | "replace"; scrollIntoView?: boolean } = {},
  ) {
    if (nextListId === activeListIdRef.current) {
      return;
    }

    activeListIdRef.current = nextListId;
    shouldScrollToActiveRef.current = options.scrollIntoView ?? true;
    const cached = user ? detailCache.get(detailCacheKey(user.id, nextListId)) : null;
    setOptimisticListId(nextListId);
    if (cached && Date.now() - cached.cachedAt < DETAIL_CACHE_TTL_MS) {
      setSnapshot(filterLocallyRemovedItems(cached.snapshot));
      setCategories(cached.categories);
      setOptimisticListId(null);
      setIsResolvingList(false);
    }
    setActiveListId(nextListId);
    if (options.history === "replace") {
      window.history.replaceState(null, "", `/lists/${nextListId}`);
    } else {
      window.history.pushState(null, "", `/lists/${nextListId}`);
    }
  }

  function handleCategoryScroll() {
    if (categoryScrollFrameRef.current) {
      window.cancelAnimationFrame(categoryScrollFrameRef.current);
    }

    categoryScrollFrameRef.current = window.requestAnimationFrame(() => {
      categoryScrollFrameRef.current = null;
      const rail = categoryRailRef.current;
      if (!rail || categories.length < 2) {
        return;
      }

      const railRect = rail.getBoundingClientRect();
      const railCenter = railRect.left + railRect.width / 2;
      let nearestListId = activeListIdRef.current;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const category of categories) {
        const element = categoryCardRefs.current.get(category.id);
        if (!element) {
          continue;
        }
        const rect = element.getBoundingClientRect();
        const cardCenter = rect.left + rect.width / 2;
        const distance = Math.abs(cardCenter - railCenter);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestListId = category.id;
        }
      }

      if (nearestListId && nearestListId !== activeListIdRef.current) {
        switchList(nearestListId, { history: "replace", scrollIntoView: false });
      }
    });
  }

  useEffect(() => {
    setActiveListId(listId);
    activeListIdRef.current = listId;
  }, [listId]);

  useEffect(() => {
    const handlePopState = () => {
      const nextListId = window.location.pathname.match(/^\/lists\/([^/]+)/)?.[1];
      if (nextListId) {
        activeListIdRef.current = nextListId;
        setActiveListId(nextListId);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    refresh(undefined, { useCache: true, listId: activeListId });
  }, [activeListId, publicToken]);

  useEffect(() => {
    if (!activeListId) {
      return;
    }
    if (!shouldScrollToActiveRef.current) {
      return;
    }
    shouldScrollToActiveRef.current = false;

    window.requestAnimationFrame(() => {
      categoryCardRefs.current.get(activeListId)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "start",
      });
    });
  }, [activeListId, categories.length]);

  useEffect(() => {
    return () => {
      if (categoryScrollFrameRef.current) {
        window.cancelAnimationFrame(categoryScrollFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!snapshot || publicToken) {
      return;
    }

    router.prefetch(`/lists/${snapshot.list.id}/settings`);
  }, [publicToken, router, snapshot?.list.id]);

  const pendingItems = snapshot?.items.filter((item) => item.status === "pending") ?? [];
  const categoryIdsKey = categories.map((category) => category.id).join("|");

  useEffect(() => {
    if (!user || publicToken || categories.length < 2) {
      return;
    }

    let active = true;

    categories.forEach((category) => {
      const cacheKey = detailCacheKey(user.id, category.id);
      const cached = detailCache.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt < DETAIL_CACHE_TTL_MS) {
        return;
      }

      loadSnapshotBundle(category.id, user.id)
        .then((bundle) => {
          if (!active || !bundle.snapshot) {
            return;
          }
          const nextSnapshot = filterLocallyRemovedItems(bundle.snapshot);
          if (!nextSnapshot) {
            return;
          }
          detailCache.set(cacheKey, {
            snapshot: nextSnapshot,
            categories: bundle.categories ?? categories,
            cachedAt: Date.now(),
          });
          setCategories((current) => [...current]);
        })
        .catch(() => {
          // Preview preloading should never block the current list.
        });
    });

    return () => {
      active = false;
    };
  }, [categoryIdsKey, publicToken, user?.id]);

  function getCategoryPreviewItems(categoryId: string) {
    if (categoryId === snapshot?.list.id) {
      return pendingItems;
    }

    if (!user) {
      return [];
    }

    const cached = detailCache.get(detailCacheKey(user.id, categoryId));
    return cached?.snapshot.items.filter((item) => item.status === "pending") ?? [];
  }

  function parseQuickAddTitles(value: string) {
    return value
      .split(/[\n,、]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (!snapshot) {
    return <FullScreenAppLoader label={isResolvingList ? "リストを読み込んでいます" : "リストを開いています"} />;
  }

  const activeCategoryId = optimisticListId ?? activeListId ?? snapshot.list.id;
  const hasSharedContext = snapshot.list.visibility !== "private" || snapshot.members.some((member) => member.id !== snapshot.owner.id);
  const canEditList = snapshot.permission === "edit" && !publicToken;
  const renderPreviewListContent = (category: ShoppingListOverview) => {
    const previewItems = getCategoryPreviewItems(category.id).slice(0, 6);
    const shouldShowPreviewOwner = category.visibility !== "private";

    return (
      <div className="item-list item-list-stack category-card-preview-list">
        {previewItems.length === 0 ? <p className="empty-state">No items</p> : null}
        {previewItems.map((item) => (
          <span
            key={item.id}
            className={cn(
              "item-row item-row-modern category-card-preview-row",
              category.visibility !== "private" ? "item-row-shared" : "item-row-personal",
              item.dueDate === todayKey() && "item-row-today",
            )}
          >
            <span className="item-row-top">
              <span className="item-check read-only" aria-hidden="true">
                <span className="item-check-ui" />
              </span>
              <span className="item-main">
                <span className="item-main-head">
                  <span className="item-title">
                    <strong>{item.title}</strong>
                  </span>
                  {item.quantity ? <span className="item-quantity">{item.quantity}</span> : null}
                </span>
                <span className="item-meta-line">
                  {shouldShowPreviewOwner ? <span className="item-meta-text">{item.createdByName}</span> : null}
                  {item.dueDate ? <span className="item-meta-text">{formatDate(item.dueDate)}</span> : null}
                </span>
              </span>
            </span>
          </span>
        ))}
        {canEditList ? <span className="list-task-add-form category-card-add-placeholder">+ Add item</span> : null}
      </div>
    );
  };
  const activeListContent = (
    <div className="item-list item-list-stack">
      {pendingItems.length === 0 ? <p className="empty-state">No items</p> : null}
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
                await refresh(user, { useCache: false });
                setMessage(null);
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "並び替えできませんでした。");
                await refresh(user, { useCache: false });
              } finally {
                setDraggingItemId(null);
              }
            });
          }}
          onToggle={async () => {
            if (!user) return;
            removeItemFromView(item.id, item.listId);
            try {
              await removeItem(snapshot.list.id, item.id, user);
              setMessage(null);
            } catch (error) {
              locallyRemovedItemsRef.current.delete(item.id);
              await refresh(user, { useCache: false });
              setMessage(error instanceof Error ? error.message : "更新できませんでした。");
            }
          }}
          onEdit={
                snapshot.permission === "edit" && !publicToken
                  ? async (payload) => {
                      if (!user) return;
                      const targetCategoryId = editCategoryId || snapshot.list.id;
                      await updateItem(snapshot.list.id, item.id, user, payload, targetCategoryId);
                      setEditingItemId(null);
                      await refresh(user, { useCache: false });
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
              remindOn: item.remindOn ?? item.dueDate,
              reminderEnabled: item.reminderEnabled,
            });
            setEditCategoryId(item.listId);
          }}
          onCancelEdit={() => setEditingItemId(null)}
          editForm={editForm}
          setEditForm={setEditForm}
          categories={categories}
          editCategoryId={editCategoryId}
          setEditCategoryId={setEditCategoryId}
        />
      ))}
      {canEditList ? (
        <form
          className="list-task-add-form"
          action={() => {
            startTransition(async () => {
              const currentUser = user;
              const currentSnapshot = snapshot;
              let optimisticIds = new Set<string>();
              try {
                if (!currentUser || !currentSnapshot) {
                  throw new Error("ログインが必要です。");
                }
                const titles = parseQuickAddTitles(form.title);
                if (titles.length === 0) {
                  throw new Error("商品名を入力してください。");
                }
                const payload = form;
                const optimisticItems = titles.map((title, index) => makeOptimisticItem(title, payload, currentUser, index));
                optimisticIds = new Set(optimisticItems.map((item) => item.id));
                updateItemsInView((items) => [...optimisticItems, ...items]);
                updateCategoriesInView((current) =>
                  current.map((category) =>
                    category.id === currentSnapshot.list.id
                      ? { ...category, pendingCount: category.pendingCount + optimisticItems.length }
                      : category,
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
                setMessage(null);

                const savedItems = await Promise.all(
                  titles.map((title) =>
                    createItem(currentSnapshot.list.id, currentUser, {
                      ...payload,
                      title,
                    }),
                  ),
                );
                const savedViews = savedItems.map((item) => toItemViewFromItem(item, currentUser));
                updateItemsInView((items) => {
                  const remaining = items.filter((item) => !optimisticIds.has(item.id));
                  return [...savedViews, ...remaining];
                });
              } catch (error) {
                if (optimisticIds.size > 0) {
                  updateItemsInView((items) => items.filter((item) => !optimisticIds.has(item.id)));
                  updateCategoriesInView((current) =>
                    current.map((category) =>
                      category.id === currentSnapshot.list.id
                        ? { ...category, pendingCount: Math.max(0, category.pendingCount - optimisticIds.size) }
                        : category,
                    ),
                  );
                }
                setMessage(error instanceof Error ? error.message : "商品追加に失敗しました。");
              }
            });
          }}
        >
          <div className="list-task-add-row">
            <div className="quick-add-title">
              <input value={form.title} placeholder="+ Add item" aria-label="商品名" onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </div>
          </div>
          {message ? <p className="notice-inline">{message}</p> : null}
        </form>
      ) : null}
    </div>
  );

  return (
    <div className="page-grid detail-shell">
      <section className={cn("panel list-section-panel list-board-panel list-carousel-stage", isResolvingList && "list-section-panel-loading")}>
        {categories.length ? (
          <div className="category-strip-wrap">
            <div className="category-toolbar">
              <div
                ref={categoryRailRef}
                className="category-card-rail"
                aria-label="カテゴリー切り替え"
                onScroll={handleCategoryScroll}
              >
                {categories.map((category, index) => (
                  <div
                    key={category.id}
                    ref={(element) => {
                      if (element) {
                        categoryCardRefs.current.set(category.id, element);
                      } else {
                        categoryCardRefs.current.delete(category.id);
                      }
                    }}
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
                          await refresh(user, { useCache: false });
                        } catch (error) {
                          setMessage(error instanceof Error ? error.message : "並び替えできませんでした。");
                          await refresh(user, { useCache: false });
                        } finally {
                          setDraggingCategoryId(null);
                        }
                      });
                    }}
                  >
                    {category.id === activeCategoryId ? (
                      <div
                        className={cn(
                          "category-card category-card-active category-card-live",
                          `category-card-tone-${index % 5}`,
                          category.visibility !== "private" && "category-card-shared",
                        )}
                        aria-label={category.name}
                      >
                        <div className="active-list-card-head">
                          <h2>{category.name}</h2>
                          {!publicToken ? (
                            <Link
                              href={`/lists/${category.id}/settings`}
                              className="settings-chip settings-chip-icon list-card-settings-button"
                              aria-label="現在のリスト設定"
                              title="設定"
                              onClick={cacheSettingsView}
                            >
                              <MenuIcon />
                            </Link>
                          ) : null}
                        </div>
                        {category.id === snapshot.list.id ? activeListContent : renderPreviewListContent(category)}
                      </div>
                    ) : (
                      <Link
                        href={`/lists/${category.id}`}
                        className={cn(
                          "category-card",
                          `category-card-tone-${index % 5}`,
                          category.visibility !== "private" && "category-card-shared",
                        )}
                        aria-label={category.name}
                        onClick={(event) => {
                          event.preventDefault();
                          switchList(category.id, { scrollIntoView: true });
                        }}
                      >
                        <div className="active-list-card-head category-card-preview-head">
                          <h2>{category.name}</h2>
                        </div>
                        {renderPreviewListContent(category)}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
              {!publicToken ? (
                <>
                  <div className={cn("category-actions", showCategoryCreate && "category-actions-hidden")}>
                    {canEditList ? (
                      <button
                        type="button"
                        className="category-add-button"
                        onClick={() => setShowCategoryCreate((current) => !current)}
                        aria-label="新しいリストを作成"
                        title="新しいリスト"
                      >
                        <PlusIcon />
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
            {showCategoryCreate && snapshot.permission === "edit" && !publicToken ? (
              <form
                className="category-create-inline"
                action={() => {
                  startTransition(async () => {
                    let optimisticListId: string | null = null;
                    try {
                      if (!user) {
                        throw new Error("ログインが必要です。");
                      }
                      const name = categoryFormName.trim() || "マイリスト";
                      const optimisticList = makeOptimisticList(name, user);
                      optimisticListId = optimisticList.id;
                      const optimisticOverview = toOverviewFromList(optimisticList, user);
                      const optimisticSnapshot: ShoppingListSnapshot = {
                        list: optimisticList,
                        owner: user,
                        members: [{ ...user, role: "owner" }],
                        items: [],
                        permission: "edit",
                      };
                      const nextCategories = [...categories, optimisticOverview];
                      shouldScrollToActiveRef.current = true;
                      setCategories(nextCategories);
                      setSnapshot(optimisticSnapshot);
                      setActiveListId(optimisticList.id);
                      setOptimisticListId(null);
                      setCategoryFormName("");
                      setShowCategoryCreate(false);
                      setMessage(null);
                      window.history.pushState(null, "", `/lists/${optimisticList.id}`);

                      const created = await createList(user, {
                        ...DEFAULT_LIST_FORM,
                        name,
                        plannedDate: null,
                        visibility: "private",
                      });
                      const savedOverview = toOverviewFromList(created, user);
                      const savedSnapshot: ShoppingListSnapshot = {
                        ...optimisticSnapshot,
                        list: created,
                      };
                      const savedCategories = nextCategories.map((category) => (category.id === optimisticList.id ? savedOverview : category));
                      setCategories(savedCategories);
                      setSnapshot(savedSnapshot);
                      setActiveListId(created.id);
                      detailCache.delete(detailCacheKey(user.id, optimisticList.id));
                      detailCache.set(detailCacheKey(user.id, created.id), {
                        snapshot: savedSnapshot,
                        categories: savedCategories,
                        cachedAt: Date.now(),
                      });
                      window.history.replaceState(null, "", `/lists/${created.id}`);
                    } catch (error) {
                      if (optimisticListId) {
                        setCategories((current) => current.filter((category) => category.id !== optimisticListId));
                        const fallback = categories[0];
                        if (fallback) {
                          switchList(fallback.id);
                        }
                      }
                      setMessage(error instanceof Error ? error.message : "リストを作成できませんでした。");
                    }
                  });
                }}
              >
                <input
                  value={categoryFormName}
                  placeholder="新しいリスト"
                  aria-label="新しいリスト"
                  onChange={(event) => setCategoryFormName(event.target.value)}
                />
              </form>
            ) : null}
            {categories.length > 1 ? (
              <div className="category-carousel-dots" aria-label="リスト切り替え">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={cn("category-carousel-dot", category.id === activeCategoryId && "category-carousel-dot-active")}
                    aria-label={`${category.name}へ移動`}
                    aria-current={category.id === activeCategoryId ? "true" : undefined}
                    onClick={() => switchList(category.id, { scrollIntoView: true })}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
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
                await onEdit({ ...editForm, remindOn: editForm.dueDate });
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
                onChange={(event) => {
                  const nextDate = event.target.value || null;
                  setEditForm((current) => ({ ...current, dueDate: nextDate, remindOn: nextDate }));
                }}
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

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 7h14" />
      <path d="M5 12h14" />
      <path d="M5 17h14" />
    </svg>
  );
}
