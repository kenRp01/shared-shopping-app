import { z } from "zod";
import type {
  LocalUserAccount,
  ReminderDeliveryLog,
  SessionRecord,
  ShoppingItem,
  ShoppingList,
  ShoppingListMember,
} from "@/lib/types";

export const LOCAL_BACKUP_VERSION = 1;

const backupErrorMessage = "ShareShopiのバックアップファイルを選択してください。";

const userSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string().min(1),
}) satisfies z.ZodType<LocalUserAccount>;

const listSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.number(),
  description: z.string(),
  plannedDate: z.string().nullable(),
  visibility: z.enum(["private", "shared", "public_link"]),
  ownerUserId: z.string().min(1),
  publicToken: z.string().nullable(),
  dailyReminderEnabled: z.boolean(),
  dailyReminderHour: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
}) satisfies z.ZodType<ShoppingList>;

const memberSchema = z.object({
  id: z.string().min(1),
  listId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(["owner", "editor"]),
  invitedByUserId: z.string().min(1),
  createdAt: z.string().min(1),
}) satisfies z.ZodType<ShoppingListMember>;

const itemSchema = z.object({
  id: z.string().min(1),
  listId: z.string().min(1),
  sortOrder: z.number(),
  title: z.string().min(1),
  quantity: z.string(),
  note: z.string(),
  status: z.enum(["pending", "purchased"]),
  scope: z.enum(["shared", "personal"]),
  dueDate: z.string().nullable(),
  dueTime: z.string().nullable(),
  remindOn: z.string().nullable(),
  reminderEnabled: z.boolean(),
  createdByUserId: z.string().min(1),
  updatedByUserId: z.string().min(1),
  purchasedByUserId: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
}) satisfies z.ZodType<ShoppingItem>;

const reminderLogSchema = z.object({
  id: z.string().min(1),
  listId: z.string().min(1),
  deliveryDate: z.string().min(1),
  status: z.enum(["sent", "skipped"]),
  sentCount: z.number(),
  createdAt: z.string().min(1),
}) satisfies z.ZodType<ReminderDeliveryLog>;

const sessionSchema = z.object({
  userId: z.string().min(1),
}) satisfies z.ZodType<SessionRecord>;

export const localBackupSchema = z.object({
  app: z.literal("ShareShopi"),
  version: z.literal(LOCAL_BACKUP_VERSION),
  exportedAt: z.string().min(1),
  data: z.object({
    users: z.array(userSchema),
    session: sessionSchema.nullable(),
    lists: z.array(listSchema),
    members: z.array(memberSchema),
    items: z.array(itemSchema),
    reminderLogs: z.array(reminderLogSchema),
  }),
});

export type LocalBackupPayload = z.infer<typeof localBackupSchema>;

type LocalBackupData = LocalBackupPayload["data"];

export function createLocalBackupPayload(
  data: LocalBackupData,
  exportedAt = new Date().toISOString(),
): LocalBackupPayload {
  return {
    app: "ShareShopi",
    version: LOCAL_BACKUP_VERSION,
    exportedAt,
    data,
  };
}

export function parseLocalBackupPayload(value: unknown): LocalBackupPayload {
  const parsed = localBackupSchema.safeParse(value);
  if (!parsed.success || !hasValidRelations(parsed.data)) {
    throw new Error(backupErrorMessage);
  }

  return parsed.data;
}

export function getLocalBackupFileName(now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  return `shareshopi-backup-${date}.json`;
}

function hasValidRelations(payload: LocalBackupPayload) {
  const userIds = new Set(payload.data.users.map((user) => user.id));
  const listIds = new Set(payload.data.lists.map((list) => list.id));

  if (payload.data.session && !userIds.has(payload.data.session.userId)) {
    return false;
  }

  return (
    payload.data.lists.every((list) => userIds.has(list.ownerUserId)) &&
    payload.data.members.every(
      (member) => listIds.has(member.listId) && userIds.has(member.userId) && userIds.has(member.invitedByUserId),
    ) &&
    payload.data.items.every(
      (item) =>
        listIds.has(item.listId) &&
        userIds.has(item.createdByUserId) &&
        userIds.has(item.updatedByUserId) &&
        (!item.purchasedByUserId || userIds.has(item.purchasedByUserId)),
    ) &&
    payload.data.reminderLogs.every((log) => listIds.has(log.listId))
  );
}
