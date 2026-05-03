"use client";

import { openDB, type DBSchema } from "idb";
import { DEFAULT_ITEM_FORM, DEFAULT_LIST_FORM } from "@/lib/constants";
import { buildReminderDigest } from "@/lib/reminders";
import { createSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase-browser";
import type {
  CreateItemPayload,
  CreateListPayload,
  LocalUserAccount,
  ReminderDeliveryLog,
  ReminderDigest,
  SessionRecord,
  ShoppingItem,
  ShoppingItemView,
  ShoppingList,
  ShoppingListMember,
  ShoppingListOverview,
  ShoppingListSnapshot,
  UpdateItemPayload,
  UpdateReminderSettingsPayload,
  UserProfile,
} from "@/lib/types";
import { formatRelativeDue, makeId, todayKey } from "@/lib/utils";
import {
  createItemSchema,
  createListSchema,
  shareMemberSchema,
  updateReminderSettingsSchema,
} from "@/lib/validation";

type UserRecord = LocalUserAccount;

interface ShoppingDb extends DBSchema {
  users: {
    key: string;
    value: UserRecord;
  };
  session: {
    key: string;
    value: SessionRecord;
  };
  lists: {
    key: string;
    value: ShoppingList;
  };
  members: {
    key: string;
    value: ShoppingListMember;
  };
  items: {
    key: string;
    value: ShoppingItem;
  };
  reminder_logs: {
    key: string;
    value: ReminderDeliveryLog;
  };
}

const DB_NAME = "shareshopi-board";
const DB_VERSION = 2;
const GUEST_USER_ID = "guest_local_user";

async function ensureListOrdering(db: Awaited<ReturnType<typeof openDB<ShoppingDb>>>) {
  const lists = await db.getAll("lists");
  const needsBackfill = lists.some((list) => typeof (list as ShoppingList & { sortOrder?: number }).sortOrder !== "number");
  if (!needsBackfill) {
    return;
  }

  const ordered = [...lists].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const tx = db.transaction("lists", "readwrite");
  await Promise.all(
    ordered.map((list, index) =>
      tx.objectStore("lists").put({
        ...list,
        sortOrder: typeof (list as ShoppingList & { sortOrder?: number }).sortOrder === "number"
          ? list.sortOrder
          : index,
      }),
    ),
  );
  await tx.done;
}

async function ensureItemOrdering(db: Awaited<ReturnType<typeof openDB<ShoppingDb>>>) {
  const items = await db.getAll("items");
  const needsBackfill = items.some((item) => typeof (item as ShoppingItem & { sortOrder?: number }).sortOrder !== "number");
  if (!needsBackfill) {
    return;
  }

  const grouped = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    grouped.set(item.listId, [...(grouped.get(item.listId) ?? []), item]);
  }

  const tx = db.transaction("items", "readwrite");
  const writes = [...grouped.values()].flatMap((listItems) =>
    [...listItems]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((item, index) =>
        tx.objectStore("items").put({
          ...item,
          sortOrder: typeof (item as ShoppingItem & { sortOrder?: number }).sortOrder === "number"
            ? item.sortOrder
            : index,
        }),
      ),
  );

  await Promise.all(writes);
  await tx.done;
}

async function getDb() {
  const db = await openDB<ShoppingDb>(DB_NAME, DB_VERSION, {
    upgrade(database, oldVersion, _newVersion, transaction) {
      if (oldVersion < 1) {
        database.createObjectStore("users", { keyPath: "id" });
        database.createObjectStore("session");
        database.createObjectStore("lists", { keyPath: "id" });
        database.createObjectStore("members", { keyPath: "id" });
        database.createObjectStore("items", { keyPath: "id" });
        database.createObjectStore("reminder_logs", { keyPath: "id" });
      }

      if (oldVersion < 2) {
        transaction.objectStore("lists").clear();
        transaction.objectStore("members").clear();
        transaction.objectStore("items").clear();
        transaction.objectStore("reminder_logs").clear();
      }
    },
  });
  await migrateLegacyDemoData(db);
  await ensureListOrdering(db);
  await ensureItemOrdering(db);
  return db;
}

async function migrateLegacyDemoData(db: Awaited<ReturnType<typeof openDB<ShoppingDb>>>) {
  for (const listId of ["list_demo_weekend", "list_demo_shared"]) {
    const list = await db.get("lists", listId);
    if (!list) {
      continue;
    }

    await db.delete("lists", listId);

    const members = (await db.getAll("members")).filter((entry) => entry.listId === listId);
    for (const member of members) {
      await db.delete("members", member.id);
    }

    const items = (await db.getAll("items")).filter((entry) => entry.listId === listId);
    for (const item of items) {
      await db.delete("items", item.id);
    }
  }
}

function toProfile(user: UserRecord): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

async function requireUser(userId: string): Promise<UserRecord> {
  const db = await getDb();
  const user = await db.get("users", userId);
  if (!user) {
    throw new Error("ユーザーが見つかりません。");
  }
  return user;
}

async function getMembersForList(listId: string) {
  const db = await getDb();
  const members = (await db.getAll("members")).filter((member) => member.listId === listId);
  return members;
}

async function getItemsForList(listId: string) {
  const db = await getDb();
  const items = (await db.getAll("items")).filter((item) => item.listId === listId);
  return items;
}

async function upsertLocalUser(account: UserRecord, persistSession: boolean) {
  const db = await getDb();
  const tx = db.transaction(["users", "session"], "readwrite");
  await tx.objectStore("users").put(account);
  if (persistSession) {
    await tx.objectStore("session").put({ userId: account.id }, "current");
  } else {
    await tx.objectStore("session").delete("current");
  }
  await tx.done;
  return toProfile(account);
}

function deriveName(email: string, fallback?: string | null) {
  return fallback?.trim() || email.split("@")[0] || "ユーザー";
}

async function syncSupabaseUserToLocal(params: {
  id: string;
  email: string;
  name?: string | null;
  persistSession: boolean;
}) {
  const db = await getDb();
  const existing = await db.get("users", params.id);
  const account: UserRecord = {
    id: params.id,
    email: params.email.toLowerCase(),
    name: params.name?.trim() || existing?.name || deriveName(params.email, params.name),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  await syncRemoteProfile(toProfile(account));
  return upsertLocalUser(account, params.persistSession);
}

function canView(list: ShoppingList, memberUserIds: string[], viewerId?: string | null) {
  if (list.visibility === "public_link") {
    return true;
  }
  if (!viewerId) {
    return false;
  }
  return viewerId === list.ownerUserId || memberUserIds.includes(viewerId);
}

function canEdit(list: ShoppingList, memberUserIds: string[], viewerId?: string | null) {
  if (!viewerId) {
    return false;
  }
  return viewerId === list.ownerUserId || memberUserIds.includes(viewerId);
}

type SupabaseProfileRow = {
  id: string;
  email: string;
  name: string;
  created_at: string;
};

type SupabaseListRow = {
  id: string;
  name: string;
  description: string | null;
  planned_date: string | null;
  visibility: "private" | "shared" | "public_link";
  owner_user_id: string;
  public_token: string | null;
  daily_reminder_enabled: boolean;
  daily_reminder_hour: string;
  created_at: string;
  updated_at: string;
};

type SupabaseMemberRow = {
  id: string;
  list_id: string;
  user_id: string;
  role: "owner" | "editor";
  invited_by_user_id: string;
  created_at: string;
};

type SupabaseItemRow = {
  id: string;
  list_id: string;
  title: string;
  quantity: string;
  note: string | null;
  status: "pending" | "purchased";
  scope: "shared" | "personal";
  due_date: string | null;
  due_time: string | null;
  remind_on: string | null;
  reminder_enabled: boolean;
  created_by_user_id: string;
  updated_by_user_id: string;
  purchased_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

function toSupabaseProfile(row: SupabaseProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at,
  };
}

function toSupabaseList(row: SupabaseListRow, sortOrder = 0): ShoppingList {
  return {
    id: row.id,
    name: row.name,
    sortOrder,
    description: row.description ?? "",
    plannedDate: row.planned_date,
    visibility: row.visibility,
    ownerUserId: row.owner_user_id,
    publicToken: row.public_token,
    dailyReminderEnabled: row.daily_reminder_enabled,
    dailyReminderHour: row.daily_reminder_hour,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSupabaseMember(row: SupabaseMemberRow): ShoppingListMember {
  return {
    id: row.id,
    listId: row.list_id,
    userId: row.user_id,
    role: row.role,
    invitedByUserId: row.invited_by_user_id,
    createdAt: row.created_at,
  };
}

function toSupabaseItem(row: SupabaseItemRow, sortOrder = 0): ShoppingItem {
  return {
    id: row.id,
    listId: row.list_id,
    sortOrder,
    title: row.title,
    quantity: row.quantity,
    note: row.note ?? "",
    status: row.status,
    scope: row.scope,
    dueDate: row.due_date,
    dueTime: row.due_time,
    remindOn: row.remind_on,
    reminderEnabled: row.reminder_enabled,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    purchasedByUserId: row.purchased_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toItemView(item: ShoppingItem, userMap: Map<string, UserRecord | UserProfile>): ShoppingItemView {
  const createdBy = userMap.get(item.createdByUserId);
  const updatedBy = userMap.get(item.updatedByUserId);
  const purchasedBy = item.purchasedByUserId ? userMap.get(item.purchasedByUserId) : null;
  return {
    ...item,
    createdByName: createdBy?.name ?? "不明",
    updatedByName: updatedBy?.name ?? "不明",
    purchasedByName: purchasedBy?.name ?? null,
    dueState: formatRelativeDue(item.dueDate, todayKey()),
    reminderState: formatRelativeDue(item.remindOn ?? item.dueDate, todayKey()),
  };
}

async function getSupabaseAccessToken() {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) {
    return null;
  }
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getSupabaseAccessToken();
  if (!token) {
    throw new Error("ログインが必要です。");
  }
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => null)) as { error?: string } | T | null;
  if (!response.ok) {
    const errorMessage =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "処理に失敗しました。";
    throw new Error(errorMessage);
  }
  return body as T;
}

async function syncRemoteProfile(profile: UserProfile) {
  if (!hasSupabaseEnv()) {
    return;
  }
  await requestJson("/api/profiles/sync", {
    method: "POST",
    body: JSON.stringify({ name: profile.name }),
  }).catch(() => null);
}

export async function signInWithGoogle() {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase の接続設定を確認してください。");
  }

  const redirectTo = `${window.location.origin}/auth/callback`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function signOutLocal() {
  if (hasSupabaseEnv()) {
    const supabase = createSupabaseBrowserClient();
    await supabase?.auth.signOut();
  }
  const db = await getDb();
  await db.delete("session", "current");
}

export async function getCurrentUser() {
  if (hasSupabaseEnv()) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return null;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.email) {
      const nameFromMeta =
        typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name
          : typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : null;

      return syncSupabaseUserToLocal({
        id: user.id,
        email: user.email,
        name: nameFromMeta,
        persistSession: true,
      });
    }
  }

  const db = await getDb();
  const session = await db.get("session", "current");
  if (!session) {
    return null;
  }
  const user = await db.get("users", session.userId);
  return user ? toProfile(user) : null;
}

export async function continueAsGuest() {
  const db = await getDb();
  let guest = await db.get("users", GUEST_USER_ID);

  if (!guest) {
    guest = {
      id: GUEST_USER_ID,
      email: "guest@shareshopi.local",
      name: "ひとり利用",
      createdAt: new Date().toISOString(),
    };
    await db.put("users", guest);
  }

  await db.put("session", { userId: guest.id }, "current");
  const profile = toProfile(guest);
  const existingLists = await listAccessibleLists(profile.id);

  if (existingLists.length > 0) {
    return { user: profile, listId: existingLists[0].id };
  }

  const starter = await createList(profile, {
    ...DEFAULT_LIST_FORM,
    name: "マイリスト",
    plannedDate: null,
    visibility: "private",
  });

  return { user: profile, listId: starter.id };
}

export async function updateUserProfile(viewer: UserProfile, payload: { name: string }) {
  const name = payload.name.trim();
  if (!name || name.length > 40) {
    throw new Error("表示名は1〜40文字で入力してください。");
  }

  if (hasSupabaseEnv()) {
    await requestJson("/api/profiles/sync", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  const db = await getDb();
  const user = await db.get("users", viewer.id);
  const nextUser: UserRecord = {
    ...(user ?? { id: viewer.id, email: viewer.email, createdAt: viewer.createdAt }),
    name,
  };
  await db.put("users", nextUser);
  return toProfile(nextUser);
}

async function listAccessibleListsFromSupabase(viewerId: string) {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) {
    return [];
  }

  const [{ data: listRows, error: listError }, { data: memberRows, error: memberError }, { data: itemRows, error: itemError }, { data: profileRows }] =
    await Promise.all([
      supabase.from("shopping_lists").select("*").order("updated_at", { ascending: false }),
      supabase.from("shopping_list_members").select("*"),
      supabase.from("shopping_items").select("*"),
      supabase.from("profiles").select("*"),
    ]);

  if (listError || memberError || itemError) {
    throw new Error(listError?.message || memberError?.message || itemError?.message || "リストを取得できませんでした。");
  }

  const members = ((memberRows ?? []) as SupabaseMemberRow[]).map(toSupabaseMember);
  const profiles = ((profileRows ?? []) as SupabaseProfileRow[]).map(toSupabaseProfile);
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const items = ((itemRows ?? []) as SupabaseItemRow[]).map((row, index) => toSupabaseItem(row, index));

  return ((listRows ?? []) as SupabaseListRow[])
    .map((row, index) => toSupabaseList(row, index))
    .filter((list) => list.ownerUserId === viewerId || members.some((member) => member.listId === list.id && member.userId === viewerId))
    .map<ShoppingListOverview>((list) => {
      const listMembers = members.filter((member) => member.listId === list.id);
      const listItems = items.filter(
        (item) => item.listId === list.id && (item.scope === "shared" || item.createdByUserId === viewerId),
      );
      const memberNames = listMembers
        .map((member) => profileMap.get(member.userId)?.name)
        .filter((value): value is string => Boolean(value));
      const pending = listItems.filter((item) => item.status === "pending");
      const purchased = listItems.filter((item) => item.status === "purchased");
      const today = todayKey();
      return {
        ...list,
        ownerName: profileMap.get(list.ownerUserId)?.name ?? "不明",
        memberNames,
        memberCount: listMembers.length,
        pendingCount: pending.length,
        purchasedCount: purchased.length,
        dueTodayCount: pending.filter((item) => item.dueDate === today).length,
        overdueCount: pending.filter((item) => item.dueDate && item.dueDate < today).length,
        reminderTodayCount: pending.filter((item) => item.reminderEnabled && (item.remindOn ?? item.dueDate) === today).length,
        viewerRole:
          viewerId === list.ownerUserId
            ? "owner"
            : listMembers.find((member) => member.userId === viewerId)?.role ?? null,
      };
    })
    .sort((left, right) => left.sortOrder - right.sortOrder || right.updatedAt.localeCompare(left.updatedAt));
}

export async function listAccessibleLists(viewerId: string) {
  if (hasSupabaseEnv() && viewerId !== GUEST_USER_ID) {
    return listAccessibleListsFromSupabase(viewerId);
  }

  const db = await getDb();
  const [lists, members, users, items] = await Promise.all([
    db.getAll("lists"),
    db.getAll("members"),
    db.getAll("users"),
    db.getAll("items"),
  ]);

  return lists
    .filter((list) => {
      const listMembers = members.filter((member) => member.listId === list.id).map((member) => member.userId);
      return canView(list, listMembers, viewerId);
    })
    .map<ShoppingListOverview>((list) => {
      const listMembers = members.filter((member) => member.listId === list.id);
      const listItems = items.filter(
        (item) => item.listId === list.id && (item.scope === "shared" || item.createdByUserId === viewerId),
      );
      const owner = users.find((user) => user.id === list.ownerUserId);
      const memberNames = listMembers
        .map((member) => users.find((user) => user.id === member.userId)?.name)
        .filter((value): value is string => Boolean(value));
      const pending = listItems.filter((item) => item.status === "pending");
      const purchased = listItems.filter((item) => item.status === "purchased");
      const today = todayKey();
      return {
        ...list,
        ownerName: owner?.name ?? "不明",
        memberNames,
        memberCount: listMembers.length,
        pendingCount: pending.length,
        purchasedCount: purchased.length,
        dueTodayCount: pending.filter((item) => item.dueDate === today).length,
        overdueCount: pending.filter((item) => item.dueDate && item.dueDate < today).length,
        reminderTodayCount: pending.filter((item) => item.reminderEnabled && (item.remindOn ?? item.dueDate) === today).length,
        viewerRole:
          viewerId === list.ownerUserId
            ? "owner"
            : listMembers.find((member) => member.userId === viewerId)?.role ?? null,
      };
    })
    .sort((left, right) => left.sortOrder - right.sortOrder || right.updatedAt.localeCompare(left.updatedAt));
}

export async function createList(viewer: UserProfile, payload: CreateListPayload) {
  const result = createListSchema.safeParse(payload);
  if (!result.success) {
    throw new Error("リスト名と通知設定を確認してください。");
  }

  if (hasSupabaseEnv() && viewer.id !== GUEST_USER_ID) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      throw new Error("Supabase の接続設定を確認してください。");
    }
    const { data: listRow, error: listError } = await supabase
      .from("shopping_lists")
      .insert({
        name: result.data.name,
        description: result.data.description,
        planned_date: result.data.plannedDate,
        visibility: result.data.visibility,
        owner_user_id: viewer.id,
        public_token: result.data.visibility === "public_link" ? makeId("public") : null,
        daily_reminder_enabled: result.data.dailyReminderEnabled,
        daily_reminder_hour: result.data.dailyReminderHour,
      })
      .select("*")
      .single();

    if (listError || !listRow) {
      throw new Error(listError?.message || "リストを作成できませんでした。");
    }

    const { error: memberError } = await supabase.from("shopping_list_members").insert({
      list_id: listRow.id,
      user_id: viewer.id,
      role: "owner",
      invited_by_user_id: viewer.id,
    });

    if (memberError) {
      throw new Error(memberError.message);
    }

    return toSupabaseList(listRow as SupabaseListRow);
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const lists = await db.getAll("lists");
  const list: ShoppingList = {
    id: makeId("list"),
    name: result.data.name,
    sortOrder: lists.length ? Math.max(...lists.map((entry) => entry.sortOrder)) + 1 : 0,
    description: result.data.description,
    plannedDate: result.data.plannedDate,
    visibility: result.data.visibility,
    ownerUserId: viewer.id,
    publicToken: result.data.visibility === "public_link" ? makeId("public") : null,
    dailyReminderEnabled: result.data.dailyReminderEnabled,
    dailyReminderHour: result.data.dailyReminderHour,
    createdAt: now,
    updatedAt: now,
  };
  const member: ShoppingListMember = {
    id: makeId("member"),
    listId: list.id,
    userId: viewer.id,
    role: "owner",
    invitedByUserId: viewer.id,
    createdAt: now,
  };

  const tx = db.transaction(["lists", "members"], "readwrite");
  await tx.objectStore("lists").put(list);
  await tx.objectStore("members").put(member);
  await tx.done;
  return list;
}

export async function reorderLists(viewer: UserProfile, orderedListIds: string[]) {
  if (hasSupabaseEnv() && viewer.id !== GUEST_USER_ID) {
    // Supabase schema v1 does not require persisted category ordering yet.
    // Keep the optimistic UI responsive and avoid failing shared-list saves.
    return;
  }

  const accessible = await listAccessibleLists(viewer.id);
  const accessibleIds = new Set(accessible.map((list) => list.id));
  if (!orderedListIds.every((id) => accessibleIds.has(id))) {
    throw new Error("並び替えできないリストが含まれています。");
  }

  const db = await getDb();
  const allLists = await db.getAll("lists");
  const listMap = new Map(allLists.map((list) => [list.id, list]));
  const now = new Date().toISOString();
  const tx = db.transaction("lists", "readwrite");

  await Promise.all(
    orderedListIds.map((listId, index) => {
      const list = listMap.get(listId);
      if (!list) {
        return Promise.resolve();
      }
      return tx.objectStore("lists").put({
        ...list,
        sortOrder: index,
        updatedAt: now,
      });
    }),
  );

  await tx.done;
}

export async function getListSnapshot(listId: string, viewerId?: string | null): Promise<ShoppingListSnapshot | null> {
  if (hasSupabaseEnv() && viewerId !== GUEST_USER_ID) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return null;
    }

    const { data: listRow, error: listError } = await supabase
      .from("shopping_lists")
      .select("*")
      .eq("id", listId)
      .single();
    if (listError || !listRow) {
      return null;
    }

    const [{ data: memberRows }, { data: profileRows }, { data: itemRows }] = await Promise.all([
      supabase.from("shopping_list_members").select("*").eq("list_id", listId),
      supabase.from("profiles").select("*"),
      supabase.from("shopping_items").select("*").eq("list_id", listId),
    ]);

    const list = toSupabaseList(listRow as SupabaseListRow);
    const members = ((memberRows ?? []) as SupabaseMemberRow[]).map(toSupabaseMember);
    const memberIds = members.map((member) => member.userId);
    if (!canView(list, memberIds, viewerId)) {
      return null;
    }

    const profiles = ((profileRows ?? []) as SupabaseProfileRow[]).map(toSupabaseProfile);
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    const owner = profileMap.get(list.ownerUserId) ?? {
      id: list.ownerUserId,
      email: "",
      name: "所有者",
      createdAt: list.createdAt,
    };

    const items = ((itemRows ?? []) as SupabaseItemRow[])
      .map((row, index) => toSupabaseItem(row, index))
      .filter((item) => {
        if (item.scope === "shared") {
          return true;
        }
        if (!viewerId) {
          return false;
        }
        return item.createdByUserId === viewerId;
      })
      .map((item) => toItemView(item, profileMap))
      .sort((left, right) => left.status.localeCompare(right.status) || left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt));

    return {
      list,
      owner,
      members: members
        .map((member) => {
          const profile = profileMap.get(member.userId);
          return profile ? { ...profile, role: member.role } : null;
        })
        .filter((value): value is UserProfile & { role: "owner" | "editor" } => Boolean(value)),
      items,
      permission: canEdit(list, memberIds, viewerId) ? "edit" : "view",
    };
  }

  const db = await getDb();
  const list = await db.get("lists", listId);
  if (!list) {
    return null;
  }
  const [members, users, items] = await Promise.all([db.getAll("members"), db.getAll("users"), db.getAll("items")]);
  const listMembers = members.filter((member) => member.listId === list.id);
  const memberIds = listMembers.map((member) => member.userId);
  if (!canView(list, memberIds, viewerId)) {
    return null;
  }

  const viewer = viewerId ? users.find((user) => user.id === viewerId) : null;
  const owner = users.find((user) => user.id === list.ownerUserId) ?? viewer;
  if (!owner) {
    return null;
  }

  const userMap = new Map(users.map((user) => [user.id, user]));
  const itemViews: ShoppingItemView[] = items
    .filter((item) => {
      if (item.listId !== list.id) {
        return false;
      }
      if (item.scope === "shared") {
        return true;
      }
      if (!viewerId) {
        return false;
      }
      return item.createdByUserId === viewerId;
    })
    .map((item) => {
      const createdBy = userMap.get(item.createdByUserId);
      const updatedBy = userMap.get(item.updatedByUserId);
      const purchasedBy = item.purchasedByUserId ? userMap.get(item.purchasedByUserId) : null;
      return {
        ...item,
        createdByName: createdBy?.name ?? "不明",
        updatedByName: updatedBy?.name ?? "不明",
        purchasedByName: purchasedBy?.name ?? null,
        dueState: formatRelativeDue(item.dueDate, todayKey()),
        reminderState: formatRelativeDue(item.remindOn ?? item.dueDate, todayKey()),
      };
    })
    .sort((left, right) => left.status.localeCompare(right.status) || left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt));

  return {
    list,
    owner: toProfile(owner),
    members: listMembers
      .map((member) => {
        const user = userMap.get(member.userId);
        return user
          ? {
              ...toProfile(user),
              role: member.role,
            }
          : null;
      })
      .filter((value): value is UserProfile & { role: "owner" | "editor" } => Boolean(value)),
    items: itemViews,
    permission: canEdit(list, memberIds, viewerId) ? "edit" : "view",
  };
}

export async function getPublicSnapshot(token: string) {
  if (hasSupabaseEnv()) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return null;
    }
    const { data: listRow } = await supabase
      .from("shopping_lists")
      .select("id")
      .eq("public_token", token)
      .eq("visibility", "public_link")
      .single();
    return listRow?.id ? getListSnapshot(listRow.id, null) : null;
  }

  const db = await getDb();
  const lists = await db.getAll("lists");
  const target = lists.find((list) => list.publicToken === token && list.visibility === "public_link");
  if (!target) {
    return null;
  }
  return getListSnapshot(target.id, null);
}

export async function createItem(listId: string, viewer: UserProfile, payload: CreateItemPayload) {
  const result = createItemSchema.safeParse(payload);
  if (!result.success) {
    throw new Error("商品名や期限の入力を確認してください。");
  }

  const snapshot = await getListSnapshot(listId, viewer.id);
  if (!snapshot || snapshot.permission !== "edit") {
    throw new Error("このリストを編集する権限がありません。");
  }

  if (hasSupabaseEnv() && viewer.id !== GUEST_USER_ID) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      throw new Error("Supabase の接続設定を確認してください。");
    }
    const { data, error } = await supabase
      .from("shopping_items")
      .insert({
        list_id: listId,
        title: result.data.title,
        quantity: result.data.quantity,
        note: result.data.note,
        status: "pending",
        scope: result.data.scope,
        due_date: result.data.dueDate,
        due_time: result.data.dueTime,
        remind_on: result.data.remindOn,
        reminder_enabled: result.data.reminderEnabled,
        created_by_user_id: viewer.id,
        updated_by_user_id: viewer.id,
      })
      .select("*")
      .single();
    if (error || !data) {
      throw new Error(error?.message || "商品を追加できませんでした。");
    }
    return toSupabaseItem(data as SupabaseItemRow);
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const listItems = (await db.getAll("items")).filter((item) => item.listId === listId);
  const item: ShoppingItem = {
    id: makeId("item"),
    listId,
    sortOrder: listItems.length ? Math.max(...listItems.map((entry) => entry.sortOrder)) + 1 : 0,
    title: result.data.title,
    quantity: result.data.quantity,
    note: result.data.note,
    status: "pending",
    scope: result.data.scope,
    dueDate: result.data.dueDate,
    dueTime: result.data.dueTime,
    remindOn: result.data.remindOn,
    reminderEnabled: result.data.reminderEnabled,
    createdByUserId: viewer.id,
    updatedByUserId: viewer.id,
    purchasedByUserId: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.put("items", item);
  const list = await db.get("lists", listId);
  if (list) {
    await db.put("lists", { ...list, updatedAt: now });
  }
  return item;
}

export async function reorderItems(listId: string, viewer: UserProfile, orderedItemIds: string[]) {
  const snapshot = await getListSnapshot(listId, viewer.id);
  if (!snapshot || snapshot.permission !== "edit") {
    throw new Error("このリストを編集する権限がありません。");
  }

  if (hasSupabaseEnv() && viewer.id !== GUEST_USER_ID) {
    return;
  }

  const visibleItemIds = new Set(snapshot.items.map((item) => item.id));
  if (!orderedItemIds.every((id) => visibleItemIds.has(id))) {
    throw new Error("並び替えできない商品が含まれています。");
  }

  const db = await getDb();
  const allItems = await db.getAll("items");
  const itemMap = new Map(allItems.map((item) => [item.id, item]));
  const now = new Date().toISOString();
  const tx = db.transaction(["items", "lists"], "readwrite");

  await Promise.all(
    orderedItemIds.map((itemId, index) => {
      const item = itemMap.get(itemId);
      if (!item || item.listId !== listId) {
        return Promise.resolve();
      }
      return tx.objectStore("items").put({
        ...item,
        sortOrder: index,
        updatedByUserId: viewer.id,
        updatedAt: now,
      });
    }),
  );

  const list = await tx.objectStore("lists").get(listId);
  if (list) {
    await tx.objectStore("lists").put({ ...list, updatedAt: now });
  }

  await tx.done;
}

export async function updateItem(
  listId: string,
  itemId: string,
  viewer: UserProfile,
  payload: UpdateItemPayload,
  nextListId?: string,
) {
  const result = createItemSchema.safeParse(payload);
  if (!result.success) {
    throw new Error("商品情報を確認してください。");
  }

  const snapshot = await getListSnapshot(listId, viewer.id);
  if (!snapshot || snapshot.permission !== "edit") {
    throw new Error("このリストを編集する権限がありません。");
  }

  const destinationListId = nextListId ?? listId;
  if (destinationListId !== listId) {
    const destinationSnapshot = await getListSnapshot(destinationListId, viewer.id);
    if (!destinationSnapshot || destinationSnapshot.permission !== "edit") {
      throw new Error("移動先カテゴリーを編集する権限がありません。");
    }
  }

  if (hasSupabaseEnv() && viewer.id !== GUEST_USER_ID) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      throw new Error("Supabase の接続設定を確認してください。");
    }
    const { error } = await supabase
      .from("shopping_items")
      .update({
        list_id: destinationListId,
        title: result.data.title,
        quantity: result.data.quantity,
        note: result.data.note,
        scope: result.data.scope,
        due_date: result.data.dueDate,
        due_time: result.data.dueTime,
        remind_on: result.data.remindOn,
        reminder_enabled: result.data.reminderEnabled,
        updated_by_user_id: viewer.id,
      })
      .eq("id", itemId);
    if (error) {
      throw new Error(error.message);
    }
    return;
  }

  const db = await getDb();
  const item = await db.get("items", itemId);
  if (!item || item.listId !== listId) {
    throw new Error("商品が見つかりません。");
  }

  const now = new Date().toISOString();
  await db.put("items", {
    ...item,
    listId: destinationListId,
    title: result.data.title,
    quantity: result.data.quantity,
    note: result.data.note,
    scope: result.data.scope,
    dueDate: result.data.dueDate,
    dueTime: result.data.dueTime,
    remindOn: result.data.remindOn,
    reminderEnabled: result.data.reminderEnabled,
    updatedByUserId: viewer.id,
    updatedAt: now,
  });

  const list = await db.get("lists", listId);
  if (list) {
    await db.put("lists", { ...list, updatedAt: now });
  }

  if (destinationListId !== listId) {
    const destinationList = await db.get("lists", destinationListId);
    if (destinationList) {
      await db.put("lists", { ...destinationList, updatedAt: now });
    }
  }
}

export async function toggleItemStatus(listId: string, itemId: string, viewer: UserProfile) {
  const snapshot = await getListSnapshot(listId, viewer.id);
  if (!snapshot || snapshot.permission !== "edit") {
    throw new Error("このリストを編集する権限がありません。");
  }
  if (hasSupabaseEnv() && viewer.id !== GUEST_USER_ID) {
    const item = snapshot.items.find((entry) => entry.id === itemId);
    if (!item) {
      throw new Error("商品が見つかりません。");
    }
    const nextStatus = item.status === "pending" ? "purchased" : "pending";
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase!
      .from("shopping_items")
      .update({
        status: nextStatus,
        purchased_by_user_id: nextStatus === "purchased" ? viewer.id : null,
        updated_by_user_id: viewer.id,
      })
      .eq("id", itemId);
    if (error) {
      throw new Error(error.message);
    }
    return;
  }
  const db = await getDb();
  const item = await db.get("items", itemId);
  if (!item) {
    throw new Error("商品が見つかりません。");
  }
  const nextStatus = item.status === "pending" ? "purchased" : "pending";
  await db.put("items", {
    ...item,
    status: nextStatus,
    purchasedByUserId: nextStatus === "purchased" ? viewer.id : null,
    updatedByUserId: viewer.id,
    updatedAt: new Date().toISOString(),
  });
}

export async function removeItem(listId: string, itemId: string, viewer: UserProfile) {
  const snapshot = await getListSnapshot(listId, viewer.id);
  if (!snapshot || snapshot.permission !== "edit") {
    throw new Error("このリストを編集する権限がありません。");
  }
  if (hasSupabaseEnv() && viewer.id !== GUEST_USER_ID) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase!.from("shopping_items").delete().eq("id", itemId);
    if (error) {
      throw new Error(error.message);
    }
    return;
  }
  const db = await getDb();
  await db.delete("items", itemId);
}

export async function removeList(listId: string, viewer: UserProfile) {
  const snapshot = await getListSnapshot(listId, viewer.id);
  if (!snapshot || snapshot.owner.id !== viewer.id) {
    throw new Error("リストを削除できるのは所有者だけです。");
  }

  if (hasSupabaseEnv() && viewer.id !== GUEST_USER_ID) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase!.from("shopping_lists").delete().eq("id", listId);
    if (error) {
      throw new Error(error.message);
    }
    return;
  }

  const db = await getDb();
  const [members, items, reminderLogs] = await Promise.all([
    db.getAll("members"),
    db.getAll("items"),
    db.getAll("reminder_logs"),
  ]);
  const tx = db.transaction(["lists", "members", "items", "reminder_logs"], "readwrite");
  await tx.objectStore("lists").delete(listId);
  await Promise.all(
    members
      .filter((member) => member.listId === listId)
      .map((member) => tx.objectStore("members").delete(member.id)),
  );
  await Promise.all(
    items
      .filter((item) => item.listId === listId)
      .map((item) => tx.objectStore("items").delete(item.id)),
  );
  await Promise.all(
    reminderLogs
      .filter((log) => log.listId === listId)
      .map((log) => tx.objectStore("reminder_logs").delete(log.id)),
  );
  await tx.done;
}

export async function addListMember(listId: string, email: string, viewer: UserProfile) {
  const result = shareMemberSchema.safeParse({ email });
  if (!result.success) {
    throw new Error("共有先のメールアドレスを確認してください。");
  }
  const snapshot = await getListSnapshot(listId, viewer.id);
  if (!snapshot || snapshot.permission !== "edit") {
    throw new Error("共有設定を変更する権限がありません。");
  }

  if (hasSupabaseEnv() && viewer.id !== GUEST_USER_ID) {
    await requestJson(`/api/lists/${listId}/members`, {
      method: "POST",
      body: JSON.stringify({ email: result.data.email }),
    });
    return;
  }

  const db = await getDb();
  const users = await db.getAll("users");
  const target = users.find((user) => user.email.toLowerCase() === result.data.email.toLowerCase());
  if (!target) {
    throw new Error("このデモでは、先に登録済みのユーザーだけ共有できます。");
  }

  const members = await getMembersForList(listId);
  if (members.some((member) => member.userId === target.id)) {
    throw new Error("そのユーザーはすでに共有メンバーです。");
  }

  const member: ShoppingListMember = {
    id: makeId("member"),
    listId,
    userId: target.id,
    role: "editor",
    invitedByUserId: viewer.id,
    createdAt: new Date().toISOString(),
  };
  await db.put("members", member);
}

export async function updateListSettings(listId: string, viewer: UserProfile, payload: UpdateReminderSettingsPayload) {
  const result = updateReminderSettingsSchema.safeParse(payload);
  if (!result.success) {
    throw new Error("通知設定を確認してください。");
  }

  const snapshot = await getListSnapshot(listId, viewer.id);
  if (!snapshot || snapshot.permission !== "edit") {
    throw new Error("設定を更新する権限がありません。");
  }

  if (hasSupabaseEnv() && viewer.id !== GUEST_USER_ID) {
    if (snapshot.owner.id !== viewer.id) {
      throw new Error("共有設定を変更できるのは所有者だけです。");
    }
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase!
      .from("shopping_lists")
      .update({
        visibility: result.data.publicEnabled ? "public_link" : result.data.visibility,
        public_token: result.data.publicEnabled ? snapshot.list.publicToken ?? makeId("public") : null,
        daily_reminder_enabled: result.data.dailyReminderEnabled,
        daily_reminder_hour: result.data.dailyReminderHour,
      })
      .eq("id", listId);
    if (error) {
      throw new Error(error.message);
    }
    return;
  }

  const db = await getDb();
  const list = await db.get("lists", listId);
  if (!list) {
    throw new Error("リストが見つかりません。");
  }

  await db.put("lists", {
    ...list,
    visibility: result.data.publicEnabled ? "public_link" : result.data.visibility,
    publicToken: result.data.publicEnabled ? list.publicToken ?? makeId("public") : null,
    dailyReminderEnabled: result.data.dailyReminderEnabled,
    dailyReminderHour: result.data.dailyReminderHour,
    updatedAt: new Date().toISOString(),
  });
}

export async function buildTodayDigests(viewer: UserProfile): Promise<ReminderDigest[]> {
  const overviews = await listAccessibleLists(viewer.id);
  const digests: ReminderDigest[] = [];
  for (const overview of overviews) {
    const snapshot = await getListSnapshot(overview.id, viewer.id);
    if (!snapshot || !snapshot.list.dailyReminderEnabled) {
      continue;
    }
    const sharedItemsOnly = snapshot.items.filter((item) => item.scope === "shared");
    const recipients = snapshot.members.map((member) => ({
      id: member.id,
      email: member.email,
      name: member.name,
      createdAt: member.createdAt,
    }));
    const digest = buildReminderDigest({ ...snapshot, items: sharedItemsOnly }, recipients);
    if (digest.itemGroup.dueToday.length || digest.itemGroup.overdue.length) {
      digests.push(digest);
    }
  }
  return digests;
}

export async function recordReminderDelivery(listId: string, sentCount: number) {
  const db = await getDb();
  const log: ReminderDeliveryLog = {
    id: makeId("reminder_log"),
    listId,
    deliveryDate: todayKey(),
    status: "sent",
    sentCount,
    createdAt: new Date().toISOString(),
  };
  await db.put("reminder_logs", log);
}

export async function createDemoItem(listId: string, viewer: UserProfile) {
  return createItem(listId, viewer, DEFAULT_ITEM_FORM);
}
