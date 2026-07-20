import { describe, expect, it } from "vitest";
import {
  createLocalBackupPayload,
  getLocalBackupFileName,
  parseLocalBackupPayload,
} from "@/lib/local-backup";
import type {
  LocalUserAccount,
  ReminderDeliveryLog,
  SessionRecord,
  ShoppingItem,
  ShoppingList,
  ShoppingListMember,
} from "@/lib/types";

const createdAt = "2026-07-20T00:00:00.000Z";

const user: LocalUserAccount = {
  id: "guest_local_user",
  email: "guest@shareshopi.local",
  name: "個人利用",
  createdAt,
};

const list: ShoppingList = {
  id: "list_local",
  name: "マイリスト",
  sortOrder: 0,
  description: "",
  plannedDate: null,
  visibility: "private",
  ownerUserId: user.id,
  publicToken: null,
  dailyReminderEnabled: false,
  dailyReminderHour: "08:00",
  createdAt,
  updatedAt: createdAt,
};

const member: ShoppingListMember = {
  id: "member_local",
  listId: list.id,
  userId: user.id,
  role: "owner",
  invitedByUserId: user.id,
  createdAt,
};

const item: ShoppingItem = {
  id: "item_local",
  listId: list.id,
  sortOrder: 0,
  title: "牛乳",
  quantity: "1",
  note: "",
  status: "pending",
  scope: "personal",
  dueDate: null,
  dueTime: null,
  remindOn: null,
  reminderEnabled: false,
  createdByUserId: user.id,
  updatedByUserId: user.id,
  purchasedByUserId: null,
  createdAt,
  updatedAt: createdAt,
};

const reminderLog: ReminderDeliveryLog = {
  id: "log_local",
  listId: list.id,
  deliveryDate: "2026-07-20",
  status: "sent",
  sentCount: 1,
  createdAt,
};

const session: SessionRecord = {
  userId: user.id,
};

describe("local backup", () => {
  it("creates and parses a ShareShopi local backup payload", () => {
    const payload = createLocalBackupPayload(
      {
        users: [user],
        session,
        lists: [list],
        members: [member],
        items: [item],
        reminderLogs: [reminderLog],
      },
      "2026-07-20T10:00:00.000Z",
    );

    expect(payload.app).toBe("ShareShopi");
    expect(payload.version).toBe(1);
    expect(payload.exportedAt).toBe("2026-07-20T10:00:00.000Z");
    expect(parseLocalBackupPayload(payload)).toEqual(payload);
  });

  it("rejects files that are not ShareShopi backups", () => {
    expect(() => parseLocalBackupPayload({ app: "OtherApp", version: 1 })).toThrow(
      "ShareShopiのバックアップファイルを選択してください。",
    );
  });

  it("rejects backups with broken relations", () => {
    const payload = createLocalBackupPayload({
      users: [user],
      session,
      lists: [{ ...list, ownerUserId: "missing_user" }],
      members: [],
      items: [],
      reminderLogs: [],
    });

    expect(() => parseLocalBackupPayload(payload)).toThrow(
      "ShareShopiのバックアップファイルを選択してください。",
    );
  });

  it("creates a stable dated backup file name", () => {
    expect(getLocalBackupFileName(new Date("2026-07-20T12:34:56.000Z"))).toBe(
      "shareshopi-backup-2026-07-20.json",
    );
  });
});
