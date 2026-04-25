import type { CreateListPayload, CreateItemPayload, ListVisibility } from "@/lib/types";

export const DESIGN_TOKENS = {
  colors: {
    bg: "#f7f5ef",
    surface: "#fffdfc",
    surfaceStrong: "#f3eee6",
    ink: "#1b2a41",
    muted: "#6a7280",
    accent: "#f26b5b",
    accentSoft: "#ffe4de",
    success: "#dff5e8",
    warning: "#fff0d8",
    line: "#ddd6cc",
  },
  rounded: {
    sm: "12px",
    md: "20px",
    lg: "32px",
  },
};

export const DEFAULT_REMINDER_HOUR = "08:00";

export const DEFAULT_LIST_FORM: CreateListPayload = {
  name: "",
  description: "",
  visibility: "shared",
  dailyReminderEnabled: true,
  dailyReminderHour: DEFAULT_REMINDER_HOUR,
};

export const DEFAULT_ITEM_FORM: CreateItemPayload = {
  title: "",
  quantity: "1",
  note: "",
  dueDate: new Date().toISOString().slice(0, 10),
  dueTime: "18:00",
  remindOn: new Date().toISOString().slice(0, 10),
  reminderEnabled: true,
};

export const VISIBILITY_LABELS: Record<ListVisibility, string> = {
  private: "自分のみ",
  shared: "共有中",
  public_link: "公開中",
};

export const DEMO_USERS = [
  { id: "user_demo_owner", email: "mika@example.com", name: "美香", password: "demo1234" },
  { id: "user_demo_partner", email: "takumi@example.com", name: "匠", password: "demo1234" },
];
