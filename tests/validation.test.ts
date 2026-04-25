import { describe, expect, it } from "vitest";
import {
  createItemSchema,
  createListSchema,
  shareMemberSchema,
  updateReminderSettingsSchema,
} from "@/lib/validation";

describe("createListSchema", () => {
  it("accepts a valid shared list payload", () => {
    const result = createListSchema.safeParse({
      name: "週末の買い物",
      description: "家族で使う",
      visibility: "shared",
      dailyReminderEnabled: true,
      dailyReminderHour: "08:00",
    });

    expect(result.success).toBe(true);
  });
});

describe("createItemSchema", () => {
  it("rejects an empty title", () => {
    const result = createItemSchema.safeParse({
      title: "",
      quantity: "1",
      note: "",
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
