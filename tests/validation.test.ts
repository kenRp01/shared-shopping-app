import { describe, expect, it } from "vitest";
import {
  contactMessageSchema,
  createItemSchema,
  createListSchema,
  inviteTokenSchema,
  shareMemberSchema,
  updateReminderSettingsSchema,
} from "@/lib/validation";
import { DEFAULT_STARTER_LISTS } from "@/lib/constants";

describe("createListSchema", () => {
  it("accepts a valid shared list payload", () => {
    const result = createListSchema.safeParse({
      name: "週末の買い物",
      description: "家族で使う",
      plannedDate: "2026-04-26",
      visibility: "shared",
      dailyReminderEnabled: true,
      dailyReminderHour: "08:00",
    });

    expect(result.success).toBe(true);
  });

  it("defines personal and shared starter lists", () => {
    expect(DEFAULT_STARTER_LISTS.map((list) => list.name)).toEqual(["マイリスト", "共有"]);
    expect(DEFAULT_STARTER_LISTS.map((list) => list.visibility)).toEqual(["private", "shared"]);
    expect(DEFAULT_STARTER_LISTS.every((list) => createListSchema.safeParse(list).success)).toBe(true);
  });
});

describe("createItemSchema", () => {
  it("rejects an empty title", () => {
    const result = createItemSchema.safeParse({
      title: "",
      quantity: "1",
      note: "",
      scope: "shared",
      dueDate: "2026-04-25",
      dueTime: "18:00",
      remindOn: "2026-04-24",
      reminderEnabled: true,
    });

    expect(result.success).toBe(false);
  });
});

describe("shareMemberSchema", () => {
  it("requires an email address", () => {
    expect(shareMemberSchema.safeParse({ email: "friend@example.com" }).success).toBe(true);
    expect(shareMemberSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });
});

describe("inviteTokenSchema", () => {
  it("accepts only 256-bit invite tokens", () => {
    expect(inviteTokenSchema.safeParse({ token: `invite_${"a".repeat(64)}` }).success).toBe(true);
    expect(inviteTokenSchema.safeParse({ token: "invite_abc-123XYZ" }).success).toBe(false);
    expect(inviteTokenSchema.safeParse({ token: "bad token!" }).success).toBe(false);
  });
});

describe("updateReminderSettingsSchema", () => {
  it("accepts reminder updates for public link mode", () => {
    const result = updateReminderSettingsSchema.safeParse({
      dailyReminderEnabled: true,
      dailyReminderHour: "09:30",
      visibility: "public_link",
      publicEnabled: true,
    });

    expect(result.success).toBe(true);
  });
});

describe("contactMessageSchema", () => {
  it("accepts a valid contact message", () => {
    const result = contactMessageSchema.safeParse({
      name: "けんすけ",
      email: "user@example.com",
      message: "共有リストの使い方について相談したいです。",
    });

    expect(result.success).toBe(true);
  });

  it("rejects short messages and invalid emails", () => {
    expect(
      contactMessageSchema.safeParse({
        name: "けんすけ",
        email: "not-an-email",
        message: "短い",
      }).success,
    ).toBe(false);
  });
});
