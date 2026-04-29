"use client";

import { openDB, type DBSchema } from "idb";
import { DEMO_USERS, DEFAULT_ITEM_FORM } from "@/lib/constants";
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
  loginSchema,
  shareMemberSchema,
  signupSchema,
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
  await ensureSeeded(db);
  await migrateLegacyDemoData(db);
  return db;
}

async function ensureSeeded(db: Awaited<ReturnType<typeof openDB<ShoppingDb>>>) {
  const existingUsers = await db.getAll("users");
  if (existingUsers.length > 0) {
    return;
  }

  const now = new Date().toISOString();
  const users: UserRecord[] = DEMO_USERS.map((user) => ({
    ...user,
    createdAt: now,
  }));

  const tx = db.transaction(["users"], "readwrite");
  await Promise.all(users.map((user) => tx.objectStore("users").put(user)));
  await tx.done;
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
    password: existing?.password ?? "",
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
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

export async function signUpLocal(payload: { name: string; email: string; password: string }) {
  const result = signupSchema.safeParse(payload);
  if (!result.success) {
    throw new Error("入力内容を確認してください。");
  }

  if (hasSupabaseEnv()) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      throw new Error("Supabase の接続設定を確認してください。");
    }

    const normalizedEmail = result.data.email.toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: result.data.password,
      options: {
        data: {
          name: result.data.name,
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user?.email) {
      throw new Error("ユーザー登録に失敗しました。");
    }

    const profile = await syncSupabaseUserToLocal({
      id: data.user.id,
      email: data.user.email,
      name:
        typeof data.user.user_metadata?.name === "string"
          ? data.user.user_metadata.name
          : result.data.name,
      persistSession: Boolean(data.session),
    });

    if (!data.session) {
      throw new Error("Supabase に登録しました。メール確認を有効にしている場合は、受信メールのリンクを開いてからログインしてください。");
    }

    return profile;
  }

  const db = await getDb();
  const users = await db.getAll("users");
  const normalizedEmail = result.data.email.toLowerCase();
  if (users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
    throw new Error("そのメールアドレスはすでに使われています。");
  }

  const account: UserRecord = {
    id: makeId("user"),
    name: result.data.name,
    email: normalizedEmail,
    password: result.data.password,
    createdAt: new Date().toISOString(),
  };

  const tx = db.transaction(["users", "session"], "readwrite");
  await tx.objectStore("users").put(account);
  await tx.objectStore("session").put({ userId: account.id }, "current");
  await tx.done;
  return toProfile(account);
}

export async function signInLocal(payload: { email: string; password: string }) {
  const result = loginSchema.safeParse(payload);
  if (!result.success) {
    throw new Error("メールアドレスまたはパスワードが正しくありません。");
  }

  if (hasSupabaseEnv()) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      throw new Error("Supabase の接続設定を確認してください。");
    }

    const normalizedEmail = result.data.email.toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: result.data.password,
    });

    if (error || !data.user?.email) {
      throw new Error(error?.message || "メールアドレスまたはパスワードが正しくありません。");
    }

    const nameFromMeta =
      typeof data.user.user_metadata?.name === "string" ? data.user.user_metadata.name : null;

    return syncSupabaseUserToLocal({
      id: data.user.id,
      email: data.user.email,
      name: nameFromMeta,
      persistSession: true,
    });
  }

  const db = await getDb();
  const users = await db.getAll("users");
  const normalizedEmail = result.data.email.toLowerCase();
  const user = users.find((entry) => entry.email.toLowerCase() === normalizedEmail && entry.password === result.data.password);
  if (!user) {
    throw new Error("メールアドレスまたはパスワードが正しくありません。");
  }

  await db.put("session", { userId: user.id }, "current");
  return toProfile(user);
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

    if (!user?.email) {
      const db = await getDb();
      await db.delete("session", "current");
      return null;
    }

    const nameFromMeta =
      typeof user.user_metadata?.name === "string" ? user.user_metadata.name : null;

    return syncSupabaseUserToLocal({
      id: user.id,
      email: user.email,
      name: nameFromMeta,
      persistSession: true,
    });
  }

  const db = await getDb();
  const session = await db.get("session", "current");
  if (!session) {
    return null;
  }
  const user = await db.get("users", session.userId);
  return user ? toProfile(user) : null;
}

export async function listAccessibleLists(viewerId: string) {
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
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function createList(viewer: UserProfile, payload: CreateListPayload) {
  const result = createListSchema.safeParse(payload);
  if (!result.success) {
    throw new Error("リスト名と通知設定を確認してください。");
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const list: ShoppingList = {
    id: makeId("list"),
    name: result.data.name,
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

export async function getListSnapshot(listId: string, viewerId?: string | null): Promise<ShoppingListSnapshot | null> {
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

  const owner = users.find((user) => user.id === list.ownerUserId);
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
    .sort((left, right) => left.status.localeCompare(right.status) || left.createdAt.localeCompare(right.createdAt));

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

  const db = await getDb();
  const now = new Date().toISOString();
  const item: ShoppingItem = {
    id: makeId("item"),
    listId,
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

export async function updateItem(listId: string, itemId: string, viewer: UserProfile, payload: UpdateItemPayload) {
  const result = createItemSchema.safeParse(payload);
  if (!result.success) {
    throw new Error("商品情報を確認してください。");
  }

  const snapshot = await getListSnapshot(listId, viewer.id);
  if (!snapshot || snapshot.permission !== "edit") {
    throw new Error("このリストを編集する権限がありません。");
  }

  const db = await getDb();
  const item = await db.get("items", itemId);
  if (!item || item.listId !== listId) {
    throw new Error("商品が見つかりません。");
  }

  const now = new Date().toISOString();
  await db.put("items", {
    ...item,
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
}

export async function toggleItemStatus(listId: string, itemId: string, viewer: UserProfile) {
  const snapshot = await getListSnapshot(listId, viewer.id);
  if (!snapshot || snapshot.permission !== "edit") {
    throw new Error("このリストを編集する権限がありません。");
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
  const db = await getDb();
  await db.delete("items", itemId);
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

export async function getDemoCredentials() {
  const db = await getDb();
  const users = await db.getAll("users");
  return users
    .filter((user) => user.password)
    .slice(0, 2)
    .map((user) => ({ email: user.email, password: user.password, name: user.name }));
}
