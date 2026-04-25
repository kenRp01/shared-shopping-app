export function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function todayKey(base = new Date()): string {
  return base.toISOString().slice(0, 10);
}

export function formatDate(value: string | null): string {
  if (!value) {
    return "未設定";
  }
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T00:00:00`));
}

export function compareDateOnly(left: string, right: string): number {
  return left.localeCompare(right);
}

export function formatRelativeDue(value: string | null, today: string): "today" | "overdue" | "upcoming" | "none" {
  if (!value) {
    return "none";
  }
  const result = compareDateOnly(value, today);
  if (result === 0) {
    return "today";
  }
  if (result < 0) {
    return "overdue";
  }
  return "upcoming";
}

export function hourLabel(value: string): string {
  return value.slice(0, 5);
}

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
