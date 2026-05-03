import { z } from "zod";

export const createListSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(140),
  plannedDate: z.string().date().nullable(),
  visibility: z.enum(["private", "shared", "public_link"]),
  dailyReminderEnabled: z.boolean(),
  dailyReminderHour: z.string().regex(/^\d{2}:\d{2}$/),
});

export const shareMemberSchema = z.object({
  email: z.string().email(),
});

export const emailAuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  name: z.string().max(40).optional(),
});

export const createItemSchema = z.object({
  title: z.string().min(1).max(80),
  quantity: z.string().min(1).max(30),
  note: z.string().max(140),
  scope: z.enum(["shared", "personal"]),
  dueDate: z.string().date().nullable(),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  remindOn: z.string().date().nullable(),
  reminderEnabled: z.boolean(),
});

export const updateReminderSettingsSchema = z.object({
  dailyReminderEnabled: z.boolean(),
  dailyReminderHour: z.string().regex(/^\d{2}:\d{2}$/),
  visibility: z.enum(["private", "shared", "public_link"]),
  publicEnabled: z.boolean(),
});
