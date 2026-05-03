export type Role = "owner" | "editor";

export type ListVisibility = "private" | "shared" | "public_link";

export type ItemStatus = "pending" | "purchased";
export type ItemScope = "shared" | "personal";

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

export type LocalUserAccount = UserProfile;

export type ShoppingList = {
  id: string;
  name: string;
  sortOrder: number;
  description: string;
  plannedDate: string | null;
  visibility: ListVisibility;
  ownerUserId: string;
  publicToken: string | null;
  dailyReminderEnabled: boolean;
  dailyReminderHour: string;
  createdAt: string;
  updatedAt: string;
};

export type ShoppingListMember = {
  id: string;
  listId: string;
  userId: string;
  role: Role;
  invitedByUserId: string;
  createdAt: string;
};

export type ShoppingItem = {
  id: string;
  listId: string;
  sortOrder: number;
  title: string;
  quantity: string;
  note: string;
  status: ItemStatus;
  scope: ItemScope;
  dueDate: string | null;
  dueTime: string | null;
  remindOn: string | null;
  reminderEnabled: boolean;
  createdByUserId: string;
  updatedByUserId: string;
  purchasedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReminderDeliveryLog = {
  id: string;
  listId: string;
  deliveryDate: string;
  status: "sent" | "skipped";
  sentCount: number;
  createdAt: string;
};

export type SessionRecord = {
  userId: string;
};

export type CreateListPayload = {
  name: string;
  description: string;
  plannedDate: string | null;
  visibility: ListVisibility;
  dailyReminderEnabled: boolean;
  dailyReminderHour: string;
};

export type ShareMemberPayload = {
  email: string;
};

export type CreateItemPayload = {
  title: string;
  quantity: string;
  note: string;
  scope: ItemScope;
  dueDate: string | null;
  dueTime: string | null;
  remindOn: string | null;
  reminderEnabled: boolean;
};

export type UpdateItemPayload = CreateItemPayload;

export type UpdateReminderSettingsPayload = {
  dailyReminderEnabled: boolean;
  dailyReminderHour: string;
  visibility: ListVisibility;
  publicEnabled: boolean;
};

export type ShoppingItemView = ShoppingItem & {
  createdByName: string;
  updatedByName: string;
  purchasedByName: string | null;
  dueState: "today" | "overdue" | "upcoming" | "none";
  reminderState: "today" | "overdue" | "upcoming" | "none";
};

export type ShoppingListOverview = ShoppingList & {
  ownerName: string;
  memberNames: string[];
  memberCount: number;
  pendingCount: number;
  purchasedCount: number;
  dueTodayCount: number;
  overdueCount: number;
  reminderTodayCount: number;
  viewerRole: Role | null;
};

export type ShoppingListSnapshot = {
  list: ShoppingList;
  owner: UserProfile;
  members: Array<UserProfile & { role: Role }>;
  items: ShoppingItemView[];
  permission: "edit" | "view";
};

export type ReminderItemGroup = {
  dueToday: ShoppingItemView[];
  overdue: ShoppingItemView[];
  dueSoon: ShoppingItemView[];
};

export type ReminderDigest = {
  listId: string;
  listName: string;
  recipients: string[];
  hourLabel: string;
  itemGroup: ReminderItemGroup;
};
