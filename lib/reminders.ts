import type { ReminderDigest, ReminderItemGroup, ShoppingItemView, ShoppingListSnapshot, UserProfile } from "@/lib/types";
import { formatRelativeDue, hourLabel, todayKey } from "@/lib/utils";

export function groupReminderItems(items: ShoppingItemView[], today = todayKey()): ReminderItemGroup {
  const pending = items.filter((item) => item.status === "pending" && item.reminderEnabled);

  return pending.reduce<ReminderItemGroup>(
    (groups, item) => {
      const state = formatRelativeDue(item.remindOn ?? item.dueDate, today);
      if (state === "today") {
        groups.dueToday.push(item);
      } else if (state === "overdue") {
        groups.overdue.push(item);
      } else if (state === "upcoming") {
        groups.dueSoon.push(item);
      }
      return groups;
    },
    { dueToday: [], overdue: [], dueSoon: [] },
  );
}

export function buildReminderDigest(
  snapshot: ShoppingListSnapshot,
  recipients: UserProfile[],
  today = todayKey(),
): ReminderDigest {
  return {
    listId: snapshot.list.id,
    listName: snapshot.list.name,
    recipients: recipients.map((recipient) => recipient.email),
    hourLabel: hourLabel(snapshot.list.dailyReminderHour),
    itemGroup: groupReminderItems(snapshot.items, today),
  };
}
