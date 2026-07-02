import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sortListsByCreatedAt } from "@/lib/list-order";
import type { CreateItemPayload, CreateListPayload, ListVisibility, Role, UpdateReminderSettingsPayload } from "@/lib/types";
import { makeId } from "@/lib/utils";

export type D1ProfileRow = {
  id: string;
  firebase_uid: string | null;
  email: string;
  name: string;
  created_at: string;
};

export type D1ListRow = {
  id: string;
  name: string;
  sort_order: number;
  description: string;
  planned_date: string | null;
  visibility: ListVisibility;
  owner_user_id: string;
  public_token: string | null;
  daily_reminder_enabled: boolean;
  daily_reminder_hour: string;
  created_at: string;
  updated_at: string;
};

export type D1MemberRow = {
  id: string;
  list_id: string;
  user_id: string;
  role: Role;
  invited_by_user_id: string;
  created_at: string;
};

export type D1ItemRow = {
  id: string;
  list_id: string;
  sort_order: number;
  title: string;
  quantity: string;
  note: string;
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

type D1RawListRow = Omit<D1ListRow, "daily_reminder_enabled"> & {
  daily_reminder_enabled: number | boolean;
};

type D1RawItemRow = Omit<D1ItemRow, "reminder_enabled"> & {
  reminder_enabled: number | boolean;
};

type D1RawInviteRow = {
  list_id: string;
  token: string;
  enabled: number | boolean;
};

export type D1Categories = {
  lists: D1ListRow[];
  members: D1MemberRow[];
  items: Array<Pick<D1ItemRow, "id" | "list_id" | "status" | "scope" | "due_date" | "remind_on" | "reminder_enabled" | "created_by_user_id">>;
  profiles: D1ProfileRow[];
};

export type D1SnapshotResponse = {
  list: D1ListRow;
  members: D1MemberRow[];
  items: D1ItemRow[];
  profiles: D1ProfileRow[];
  categories?: D1Categories;
};

export async function getD1Database() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env.DB ?? null;
  } catch {
    return null;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeList(row: D1RawListRow): D1ListRow {
  return {
    ...row,
    daily_reminder_enabled: Boolean(row.daily_reminder_enabled),
  };
}

function normalizeItem(row: D1RawItemRow): D1ItemRow {
  return {
    ...row,
    reminder_enabled: Boolean(row.reminder_enabled),
  };
}

function placeholders(values: unknown[]) {
  return values.map(() => "?").join(",");
}

async function all<T extends Record<string, unknown>>(db: D1Database, sql: string, ...params: unknown[]) {
  const result = await db.prepare(sql).bind(...params).all<T>();
  return result.results ?? [];
}

async function first<T extends Record<string, unknown>>(db: D1Database, sql: string, ...params: unknown[]) {
  return db.prepare(sql).bind(...params).first<T>();
}

export async function upsertD1Profile(db: D1Database, profile: { id: string; email: string; name: string }) {
  await db
    .prepare(
      `
        INSERT INTO profiles (id, email, name)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          email = excluded.email,
          name = excluded.name
      `,
    )
    .bind(profile.id, profile.email.toLowerCase(), profile.name)
    .run();

  return first<D1ProfileRow>(db, "SELECT * FROM profiles WHERE id = ?", profile.id);
}

export async function resolveD1FirebaseProfile(
  db: D1Database,
  firebaseUser: { uid: string; email: string; name: string },
) {
  const email = firebaseUser.email.toLowerCase();
  const byFirebaseUid = await first<D1ProfileRow>(db, "SELECT * FROM profiles WHERE firebase_uid = ?", firebaseUser.uid);
  if (byFirebaseUid) {
    await db.prepare("UPDATE profiles SET email = ?, name = ? WHERE id = ?").bind(email, firebaseUser.name, byFirebaseUid.id).run();
    return first<D1ProfileRow>(db, "SELECT * FROM profiles WHERE id = ?", byFirebaseUid.id);
  }

  const byEmail = await first<D1ProfileRow>(db, "SELECT * FROM profiles WHERE email = ?", email);
  if (byEmail) {
    await db
      .prepare("UPDATE profiles SET firebase_uid = ?, name = ? WHERE id = ?")
      .bind(firebaseUser.uid, firebaseUser.name, byEmail.id)
      .run();
    return first<D1ProfileRow>(db, "SELECT * FROM profiles WHERE id = ?", byEmail.id);
  }

  await db
    .prepare("INSERT INTO profiles (id, firebase_uid, email, name) VALUES (?, ?, ?, ?)")
    .bind(firebaseUser.uid, firebaseUser.uid, email, firebaseUser.name)
    .run();
  return first<D1ProfileRow>(db, "SELECT * FROM profiles WHERE id = ?", firebaseUser.uid);
}

export async function findD1ProfileByEmail(db: D1Database, email: string) {
  return first<D1ProfileRow>(db, "SELECT * FROM profiles WHERE email = ?", email.toLowerCase());
}

export async function getD1AccessibleCategories(db: D1Database, viewerId: string): Promise<D1Categories> {
  const rawLists = await all<D1RawListRow>(
    db,
    `
      SELECT DISTINCT l.*
      FROM shopping_lists l
      LEFT JOIN shopping_list_members m ON m.list_id = l.id
      WHERE l.owner_user_id = ? OR m.user_id = ?
      ORDER BY l.created_at ASC, l.id ASC
    `,
    viewerId,
    viewerId,
  );
  const lists = sortListsByCreatedAt(rawLists.map(normalizeList));
  const listIds = lists.map((list) => list.id);
  if (!listIds.length) {
    return { lists: [], members: [], items: [], profiles: [] };
  }

  const inClause = placeholders(listIds);
  const [members, rawItems] = await Promise.all([
    all<D1MemberRow>(db, `SELECT * FROM shopping_list_members WHERE list_id IN (${inClause})`, ...listIds),
    all<
      Pick<D1RawItemRow, "id" | "list_id" | "status" | "scope" | "due_date" | "remind_on" | "reminder_enabled" | "created_by_user_id">
    >(
      db,
      `
        SELECT id, list_id, status, scope, due_date, remind_on, reminder_enabled, created_by_user_id
        FROM shopping_items
        WHERE list_id IN (${inClause})
      `,
      ...listIds,
    ),
  ]);

  const profileIds = [...new Set([...lists.map((list) => list.owner_user_id), ...members.map((member) => member.user_id)])];
  const profiles = profileIds.length
    ? await all<D1ProfileRow>(db, `SELECT * FROM profiles WHERE id IN (${placeholders(profileIds)})`, ...profileIds)
    : [];

  return {
    lists,
    members,
    items: rawItems.map((item) => ({ ...item, reminder_enabled: Boolean(item.reminder_enabled) })),
    profiles,
  };
}

export async function getD1ListSnapshot(
  db: D1Database,
  viewerId: string,
  listId: string,
  options: { settingsOnly?: boolean; includeCategories?: boolean } = {},
): Promise<D1SnapshotResponse | null> {
  const rawList = await first<D1RawListRow>(db, "SELECT * FROM shopping_lists WHERE id = ?", listId);
  if (!rawList) {
    return null;
  }
  const list = normalizeList(rawList);
  const members = await all<D1MemberRow>(db, "SELECT * FROM shopping_list_members WHERE list_id = ?", listId);
  const canView = list.owner_user_id === viewerId || members.some((member) => member.user_id === viewerId);
  if (!canView) {
    throw new Error("FORBIDDEN");
  }

  const rawItems = options.settingsOnly ? [] : await all<D1RawItemRow>(db, "SELECT * FROM shopping_items WHERE list_id = ? ORDER BY created_at ASC, id ASC", listId);
  const items = rawItems.map(normalizeItem);
  const profileIds = [
    ...new Set([
      list.owner_user_id,
      ...members.map((member) => member.user_id),
      ...items.flatMap((item) => [item.created_by_user_id, item.updated_by_user_id, item.purchased_by_user_id]).filter(Boolean),
    ]),
  ] as string[];
  const profiles = profileIds.length
    ? await all<D1ProfileRow>(db, `SELECT * FROM profiles WHERE id IN (${placeholders(profileIds)})`, ...profileIds)
    : [];
  const categories = options.includeCategories ? await getD1AccessibleCategories(db, viewerId) : undefined;

  return { list, members, items, profiles, categories };
}

export async function getD1PublicSnapshot(db: D1Database, token: string): Promise<D1SnapshotResponse | null> {
  const rawList = await first<D1RawListRow>(
    db,
    "SELECT * FROM shopping_lists WHERE public_token = ? AND visibility = 'public_link'",
    token,
  );
  if (!rawList) {
    return null;
  }

  const list = normalizeList(rawList);
  const [members, rawItems] = await Promise.all([
    all<D1MemberRow>(db, "SELECT * FROM shopping_list_members WHERE list_id = ?", list.id),
    all<D1RawItemRow>(db, "SELECT * FROM shopping_items WHERE list_id = ? AND scope = 'shared' ORDER BY created_at ASC, id ASC", list.id),
  ]);
  const items = rawItems.map(normalizeItem);
  const profileIds = [
    ...new Set([
      list.owner_user_id,
      ...members.map((member) => member.user_id),
      ...items.flatMap((item) => [item.created_by_user_id, item.updated_by_user_id, item.purchased_by_user_id]).filter(Boolean),
    ]),
  ] as string[];
  const profiles = profileIds.length
    ? await all<D1ProfileRow>(db, `SELECT * FROM profiles WHERE id IN (${placeholders(profileIds)})`, ...profileIds)
    : [];

  return { list, members, items, profiles };
}

export async function createD1List(db: D1Database, viewer: { id: string; email?: string | null; name: string }, payload: CreateListPayload) {
  await upsertD1Profile(db, {
    id: viewer.id,
    email: viewer.email?.toLowerCase() ?? `${viewer.id}@shareshopi.local`,
    name: viewer.name,
  });

  const listId = makeId("list");
  const publicToken = payload.visibility === "public_link" ? makeId("public") : null;
  const timestamp = nowIso();
  await db
    .prepare(
      `
        INSERT INTO shopping_lists (
          id, name, description, planned_date, visibility, owner_user_id, public_token,
          daily_reminder_enabled, daily_reminder_hour, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      listId,
      payload.name,
      payload.description,
      payload.plannedDate,
      payload.visibility,
      viewer.id,
      publicToken,
      payload.dailyReminderEnabled ? 1 : 0,
      payload.dailyReminderHour,
      timestamp,
      timestamp,
    )
    .run();

  await db
    .prepare(
      `
        INSERT INTO shopping_list_members (id, list_id, user_id, role, invited_by_user_id, created_at)
        VALUES (?, ?, ?, 'owner', ?, ?)
        ON CONFLICT(list_id, user_id) DO UPDATE SET role = 'owner'
      `,
    )
    .bind(makeId("member"), listId, viewer.id, viewer.id, timestamp)
    .run();

  const list = await first<D1RawListRow>(db, "SELECT * FROM shopping_lists WHERE id = ?", listId);
  return list ? normalizeList(list) : null;
}

export async function updateD1ListSettings(db: D1Database, viewerId: string, listId: string, payload: UpdateReminderSettingsPayload) {
  const list = await first<D1RawListRow>(db, "SELECT id, owner_user_id, public_token FROM shopping_lists WHERE id = ?", listId);
  if (!list) {
    return { status: 404 as const, error: "リストが見つかりません。" };
  }
  if (list.owner_user_id !== viewerId) {
    return { status: 403 as const, error: "共有設定を変更できるのは所有者だけです。" };
  }

  await db
    .prepare(
      `
        UPDATE shopping_lists
        SET visibility = ?, public_token = ?, daily_reminder_enabled = ?, daily_reminder_hour = ?, updated_at = ?
        WHERE id = ?
      `,
    )
    .bind(
      payload.publicEnabled ? "public_link" : payload.visibility,
      payload.publicEnabled ? list.public_token ?? makeId("public") : null,
      payload.dailyReminderEnabled ? 1 : 0,
      payload.dailyReminderHour,
      nowIso(),
      listId,
    )
    .run();
  return { status: 200 as const };
}

export async function deleteD1List(db: D1Database, viewerId: string, listId: string) {
  const list = await first<Pick<D1ListRow, "id" | "owner_user_id">>(db, "SELECT id, owner_user_id FROM shopping_lists WHERE id = ?", listId);
  if (!list) {
    return { status: 404 as const, error: "リストが見つかりません。" };
  }
  if (list.owner_user_id !== viewerId) {
    return { status: 403 as const, error: "リストを削除できるのは所有者だけです。" };
  }
  await db.prepare("DELETE FROM shopping_lists WHERE id = ?").bind(listId).run();
  return { status: 200 as const };
}

export async function canEditD1List(db: D1Database, viewerId: string, listId: string) {
  const rawList = await first<D1RawListRow>(db, "SELECT * FROM shopping_lists WHERE id = ?", listId);
  if (!rawList) {
    return { status: 404 as const, error: "リストが見つかりません。" };
  }
  const members = await all<D1MemberRow>(db, "SELECT * FROM shopping_list_members WHERE list_id = ?", listId);
  const list = normalizeList(rawList);
  const canEdit = list.owner_user_id === viewerId || members.some((member) => member.user_id === viewerId);
  if (!canEdit) {
    return { status: 403 as const, error: "このリストを編集する権限がありません。" };
  }
  return { status: 200 as const, list, members };
}

export async function createD1Item(db: D1Database, viewerId: string, listId: string, payload: CreateItemPayload) {
  const auth = await canEditD1List(db, viewerId, listId);
  if (auth.status !== 200) {
    return auth;
  }
  const itemId = makeId("item");
  const timestamp = nowIso();
  await db
    .prepare(
      `
        INSERT INTO shopping_items (
          id, list_id, title, quantity, note, status, scope, due_date, due_time, remind_on,
          reminder_enabled, created_by_user_id, updated_by_user_id, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      itemId,
      listId,
      payload.title,
      payload.quantity,
      payload.note,
      payload.scope,
      payload.dueDate,
      payload.dueTime,
      payload.remindOn,
      payload.reminderEnabled ? 1 : 0,
      viewerId,
      viewerId,
      timestamp,
      timestamp,
    )
    .run();
  await db.prepare("UPDATE shopping_lists SET updated_at = ? WHERE id = ?").bind(timestamp, listId).run();
  const item = await first<D1RawItemRow>(db, "SELECT * FROM shopping_items WHERE id = ?", itemId);
  return { status: 200 as const, item: item ? normalizeItem(item) : null };
}

export async function updateD1Item(
  db: D1Database,
  viewerId: string,
  listId: string,
  itemId: string,
  body: { toggleStatus?: boolean; payload?: CreateItemPayload; nextListId?: string },
) {
  const auth = await canEditD1List(db, viewerId, listId);
  if (auth.status !== 200) {
    return auth;
  }
  const current = await first<D1RawItemRow>(db, "SELECT * FROM shopping_items WHERE id = ? AND list_id = ?", itemId, listId);
  if (!current) {
    return { status: 404 as const, error: "商品が見つかりません。" };
  }
  const timestamp = nowIso();
  if (body.toggleStatus) {
    const nextStatus = current.status === "pending" ? "purchased" : "pending";
    await db
      .prepare(
        `
          UPDATE shopping_items
          SET status = ?, purchased_by_user_id = ?, updated_by_user_id = ?, updated_at = ?
          WHERE id = ?
        `,
      )
      .bind(nextStatus, nextStatus === "purchased" ? viewerId : null, viewerId, timestamp, itemId)
      .run();
    await db.prepare("UPDATE shopping_lists SET updated_at = ? WHERE id = ?").bind(timestamp, listId).run();
    return { status: 200 as const };
  }

  if (!body.payload) {
    return { status: 400 as const, error: "商品情報を確認してください。" };
  }
  const destinationListId = body.nextListId ?? listId;
  if (destinationListId !== listId) {
    const destinationAuth = await canEditD1List(db, viewerId, destinationListId);
    if (destinationAuth.status !== 200) {
      return destinationAuth;
    }
  }

  await db
    .prepare(
      `
        UPDATE shopping_items
        SET list_id = ?, title = ?, quantity = ?, note = ?, scope = ?, due_date = ?, due_time = ?,
            remind_on = ?, reminder_enabled = ?, updated_by_user_id = ?, updated_at = ?
        WHERE id = ?
      `,
    )
    .bind(
      destinationListId,
      body.payload.title,
      body.payload.quantity,
      body.payload.note,
      body.payload.scope,
      body.payload.dueDate,
      body.payload.dueTime,
      body.payload.remindOn,
      body.payload.reminderEnabled ? 1 : 0,
      viewerId,
      timestamp,
      itemId,
    )
    .run();
  await db
    .prepare(`UPDATE shopping_lists SET updated_at = ? WHERE id IN (${placeholders([listId, destinationListId])})`)
    .bind(timestamp, listId, destinationListId)
    .run();
  return { status: 200 as const };
}

export async function deleteD1Item(db: D1Database, viewerId: string, listId: string, itemId: string) {
  const auth = await canEditD1List(db, viewerId, listId);
  if (auth.status !== 200) {
    return auth;
  }
  await db.prepare("DELETE FROM shopping_items WHERE id = ? AND list_id = ?").bind(itemId, listId).run();
  await db.prepare("UPDATE shopping_lists SET updated_at = ? WHERE id = ?").bind(nowIso(), listId).run();
  return { status: 200 as const };
}

export async function addD1ListMember(db: D1Database, viewerId: string, listId: string, target: D1ProfileRow) {
  const list = await first<Pick<D1ListRow, "id" | "owner_user_id">>(db, "SELECT id, owner_user_id FROM shopping_lists WHERE id = ?", listId);
  if (!list) {
    return { status: 404 as const, error: "リストが見つかりません。" };
  }
  if (list.owner_user_id !== viewerId) {
    return { status: 403 as const, error: "共有メンバーを追加できるのは所有者だけです。" };
  }
  if (target.id === viewerId) {
    return { status: 400 as const, error: "自分自身はすでに所有者です。" };
  }
  await db
    .prepare(
      `
        INSERT INTO shopping_list_members (id, list_id, user_id, role, invited_by_user_id)
        VALUES (?, ?, ?, 'editor', ?)
        ON CONFLICT(list_id, user_id) DO UPDATE SET role = 'editor', invited_by_user_id = excluded.invited_by_user_id
      `,
    )
    .bind(makeId("member"), listId, target.id, viewerId)
    .run();
  await db.prepare("UPDATE shopping_lists SET visibility = 'shared', updated_at = ? WHERE id = ?").bind(nowIso(), listId).run();
  return { status: 200 as const, member: target };
}

export async function createD1Invite(db: D1Database, viewerId: string, origin: string, listId: string) {
  const list = await first<Pick<D1ListRow, "id" | "owner_user_id">>(db, "SELECT id, owner_user_id FROM shopping_lists WHERE id = ?", listId);
  if (!list) {
    return { status: 404 as const, error: "リストが見つかりません。" };
  }
  if (list.owner_user_id !== viewerId) {
    return { status: 403 as const, error: "招待リンクを作成できるのは所有者だけです。" };
  }
  const existing = await first<Pick<D1RawInviteRow, "token">>(
    db,
    "SELECT token FROM shopping_list_invites WHERE list_id = ? AND enabled = 1 ORDER BY created_at DESC LIMIT 1",
    listId,
  );
  const token = existing?.token ?? makeId("invite");
  if (!existing?.token) {
    await db
      .prepare("INSERT INTO shopping_list_invites (id, list_id, token, enabled, created_by_user_id) VALUES (?, ?, ?, 1, ?)")
      .bind(makeId("invite_row"), listId, token, viewerId)
      .run();
  }
  await db.prepare("UPDATE shopping_lists SET visibility = 'shared', updated_at = ? WHERE id = ?").bind(nowIso(), listId).run();
  return { status: 200 as const, invite: { token, url: `${origin}/invite/${token}` } };
}

export async function acceptD1Invite(db: D1Database, viewerId: string, token: string) {
  const invite = await first<D1RawInviteRow>(db, "SELECT list_id, token, enabled FROM shopping_list_invites WHERE token = ? AND enabled = 1", token);
  if (!invite?.enabled) {
    return { status: 404 as const, error: "招待リンクが見つかりません。" };
  }
  const list = await first<Pick<D1ListRow, "id" | "owner_user_id">>(db, "SELECT id, owner_user_id FROM shopping_lists WHERE id = ?", invite.list_id);
  if (!list) {
    return { status: 404 as const, error: "リストが見つかりません。" };
  }
  if (list.owner_user_id !== viewerId) {
    await db
      .prepare(
        `
          INSERT INTO shopping_list_members (id, list_id, user_id, role, invited_by_user_id)
          VALUES (?, ?, ?, 'editor', ?)
          ON CONFLICT(list_id, user_id) DO UPDATE SET role = 'editor'
        `,
      )
      .bind(makeId("member"), list.id, viewerId, list.owner_user_id)
      .run();
  }
  await db.prepare("UPDATE shopping_lists SET visibility = 'shared', updated_at = ? WHERE id = ?").bind(nowIso(), list.id).run();
  return { status: 200 as const, listId: list.id };
}

export async function getD1ReminderLists(db: D1Database) {
  const rows = await all<D1RawListRow>(db, "SELECT * FROM shopping_lists WHERE daily_reminder_enabled = 1");
  return rows.map(normalizeList);
}

export async function getD1ReminderLog(db: D1Database, listId: string, deliveryDate: string) {
  return first<{ id: string; status: "sent" | "skipped" }>(
    db,
    "SELECT id, status FROM reminder_delivery_logs WHERE list_id = ? AND delivery_date = ?",
    listId,
    deliveryDate,
  );
}

export async function getD1ReminderSnapshot(db: D1Database, list: D1ListRow, deliveryDate: string) {
  const [members, rawItems] = await Promise.all([
    all<D1MemberRow>(db, "SELECT * FROM shopping_list_members WHERE list_id = ?", list.id),
    all<D1RawItemRow>(
      db,
      `
        SELECT *
        FROM shopping_items
        WHERE list_id = ?
          AND status = 'pending'
          AND scope = 'shared'
          AND reminder_enabled = 1
          AND (remind_on <= ? OR (remind_on IS NULL AND due_date <= ?))
      `,
      list.id,
      deliveryDate,
      deliveryDate,
    ),
  ]);
  const items = rawItems.map(normalizeItem);
  const profileIds = [
    ...new Set([
      list.owner_user_id,
      ...members.map((member) => member.user_id),
      ...items.flatMap((item) => [item.created_by_user_id, item.updated_by_user_id, item.purchased_by_user_id]).filter(Boolean),
    ]),
  ] as string[];
  const profiles = profileIds.length
    ? await all<D1ProfileRow>(db, `SELECT * FROM profiles WHERE id IN (${placeholders(profileIds)})`, ...profileIds)
    : [];
  return { members, items, profiles };
}

export async function upsertD1ReminderLog(db: D1Database, listId: string, deliveryDate: string, status: "sent" | "skipped", sentCount: number) {
  await db
    .prepare(
      `
        INSERT INTO reminder_delivery_logs (id, list_id, delivery_date, status, sent_count)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(list_id, delivery_date) DO UPDATE SET
          status = excluded.status,
          sent_count = excluded.sent_count
      `,
    )
    .bind(makeId("log"), listId, deliveryDate, status, sentCount)
    .run();
}
