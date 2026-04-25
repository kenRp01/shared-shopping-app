import { describe, expect, it } from "vitest";
import { buildReminderDigest, groupReminderItems } from "@/lib/reminders";
import type { ShoppingListSnapshot } from "@/lib/types";

const snapshot: ShoppingListSnapshot = {
  list: {
    id: "list_1",
    name: "買い物",
    description: "",
    visibility: "shared",
    ownerUserId: "user_1",
    publicToken: null,
    dailyReminderEnabled: true,
    dailyReminderHour: "08:00",
    createdAt: "2026-04-25T00:00:00.000Z",
    updatedAt: "2026-04-25T00:00:00.000Z",
  },
  owner: {
    id: "user_1",
    email: "owner@example.com",
    name: "Owner",
    createdAt: "2026-04-25T00:00:00.000Z",
  },
  members: [
    {
      id: "user_1",
      email: "owner@example.com",
      name: "Owner",
      createdAt: "2026-04-25T00:00:00.000Z",
      role: "owner",
    },
  ],
  permission: "edit",
  items: [
    {
      id: "today",
      listId: "list_1",
      title: "牛乳",
      quantity: "1本",
      note: "",
      status: "pending",
      dueDate: "2026-04-25",
      dueTime: "18:00",
      remindOn: "2026-04-26",
      reminderEnabled: true,
      createdByUserId: "user_1",
      updatedByUserId: "user_1",
      purchasedByUserId: null,
      createdAt: "2026-04-25T00:00:00.000Z",
      updatedAt: "2026-04-25T00:00:00.000Z",
      createdByName: "Owner",
      updatedByName: "Owner",
      purchasedByName: null,
      dueState: "today",
      reminderState: "upcoming",
    },
    {
      id: "overdue",
      listId: "list_1",
      title: "卵",
      quantity: "1パック",
      note: "",
      status: "pending",
      dueDate: "2026-04-24",
      dueTime: "12:00",
      remindOn: "2026-04-25",
      reminderEnabled: true,
      createdByUserId: "user_1",
      updatedByUserId: "user_1",
      purchasedByUserId: null,
      createdAt: "2026-04-25T00:00:00.000Z",
      updatedAt: "2026-04-25T00:00:00.000Z",
      createdByName: "Owner",
      updatedByName: "Owner",
      purchasedByName: null,
      dueState: "overdue",
      reminderState: "today",
    },
    {
      id: "done",
      listId: "list_1",
      title: "パン",
      quantity: "1袋",
      note: "",
      status: "purchased",
      dueDate: "2026-04-25",
      dueTime: "10:00",
      remindOn: "2026-04-25",
      reminderEnabled: true,
      createdByUserId: "user_1",
      updatedByUserId: "user_1",
      purchasedByUserId: "user_1",
      createdAt: "2026-04-25T00:00:00.000Z",
      updatedAt: "2026-04-25T00:00:00.000Z",
      createdByName: "Owner",
      updatedByName: "Owner",
      purchasedByName: "Owner",
      dueState: "today",
      reminderState: "today",
    },
  ],
};

describe("groupReminderItems", () => {
  it("splits pending items into due buckets", () => {
    const groups = groupReminderItems(snapshot.items, "2026-04-25");
    expect(groups.dueToday).toHaveLength(1);
    expect(groups.overdue).toHaveLength(0);
    expect(groups.dueSoon).toHaveLength(1);
  });
});

describe("buildReminderDigest", () => {
  it("creates a digest without purchased items", () => {
    const digest = buildReminderDigest(snapshot, [snapshot.owner], "2026-04-25");
    expect(digest.recipients).toEqual(["owner@example.com"]);
    expect(digest.itemGroup.dueToday[0]?.title).toBe("卵");
    expect(digest.itemGroup.dueSoon[0]?.title).toBe("牛乳");
  });
});
