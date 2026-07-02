import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { getD1Database, getD1ReminderLists, getD1ReminderLog, getD1ReminderSnapshot, upsertD1ReminderLog } from "@/lib/d1";
import { buildReminderDigest } from "@/lib/reminders";
import type { ReminderDigest, ShoppingItemView, ShoppingListSnapshot, UserProfile } from "@/lib/types";
import { formatRelativeDue, todayKey } from "@/lib/utils";

type ResendPayload = {
  from: string;
  to: string[];
  subject: string;
  html: string;
};

type ReminderListRow = {
  id: string;
  name: string;
  description: string;
  planned_date: string | null;
  visibility: "private" | "shared" | "public_link";
  owner_user_id: string;
  public_token: string | null;
  daily_reminder_enabled: boolean;
  daily_reminder_hour: string;
  created_at: string;
  updated_at: string;
};

type ReminderMemberRow = {
  id: string;
  list_id: string;
  user_id: string;
  role: "owner" | "editor";
  invited_by_user_id: string;
  created_at: string;
};

type ReminderItemRow = {
  id: string;
  list_id: string;
  title: string;
  quantity: string;
  note: string;
  status: "pending" | "purchased";
  scope: "shared" | "personal";
  due_date: string | null;
  due_time: string | null;
  remind_on: string | null;
  reminder_enabled: boolean;
  created_by_user_id: string;
  updated_by_user_id: string;
  purchased_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type ReminderProfileRow = {
  id: string;
  email: string;
  name: string;
  created_at: string;
};

function toProfile(row: ReminderProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at,
  };
}

function toSnapshot(
  list: ReminderListRow,
  members: ReminderMemberRow[],
  items: ReminderItemRow[],
  profiles: ReminderProfileRow[],
  today: string,
): ShoppingListSnapshot | null {
  const profileMap = new Map(profiles.map((profile) => [profile.id, toProfile(profile)]));
  const owner = profileMap.get(list.owner_user_id);
  if (!owner) {
    return null;
  }

  const itemViews: ShoppingItemView[] = items.map((item, index) => {
    const createdBy = profileMap.get(item.created_by_user_id);
    const updatedBy = profileMap.get(item.updated_by_user_id);
    const purchasedBy = item.purchased_by_user_id ? profileMap.get(item.purchased_by_user_id) : null;
    return {
      id: item.id,
      listId: item.list_id,
      sortOrder: index,
      title: item.title,
      quantity: item.quantity,
      note: item.note,
      status: item.status,
      scope: item.scope,
      dueDate: item.due_date,
      dueTime: item.due_time,
      remindOn: item.remind_on,
      reminderEnabled: item.reminder_enabled,
      createdByUserId: item.created_by_user_id,
      updatedByUserId: item.updated_by_user_id,
      purchasedByUserId: item.purchased_by_user_id,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      createdByName: createdBy?.name ?? "不明",
      updatedByName: updatedBy?.name ?? "不明",
      purchasedByName: purchasedBy?.name ?? null,
      dueState: formatRelativeDue(item.due_date, today),
      reminderState: formatRelativeDue(item.remind_on ?? item.due_date, today),
    };
  });

  return {
    list: {
      id: list.id,
      name: list.name,
      sortOrder: 0,
      description: list.description,
      plannedDate: list.planned_date,
      visibility: list.visibility,
      ownerUserId: list.owner_user_id,
      publicToken: list.public_token,
      dailyReminderEnabled: list.daily_reminder_enabled,
      dailyReminderHour: list.daily_reminder_hour,
      createdAt: list.created_at,
      updatedAt: list.updated_at,
    },
    owner,
    members: members
      .map((member) => {
        const profile = profileMap.get(member.user_id);
        return profile ? { ...profile, role: member.role } : null;
      })
      .filter((profile): profile is UserProfile & { role: "owner" | "editor" } => Boolean(profile)),
    items: itemViews,
    permission: "view",
  };
}

function hasReminderTargets(digest: ReminderDigest) {
  return digest.itemGroup.dueToday.length > 0 || digest.itemGroup.overdue.length > 0;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char] ?? char;
  });
}

function renderDigest(digest: ReminderDigest) {
  const sections = [
    { title: "今日が期限", items: digest.itemGroup.dueToday },
    { title: "期限切れ", items: digest.itemGroup.overdue },
  ].filter((section) => section.items.length > 0);

  return `
    <div style="font-family: sans-serif; line-height: 1.6;">
      <h2>${escapeHtml(digest.listName)} の買い物リマインド</h2>
      <p>${escapeHtml(digest.hourLabel)} 頃に送る想定のまとめ通知です。</p>
      ${sections
        .map(
          (section) => `
            <h3>${escapeHtml(section.title)}</h3>
            <ul>
              ${section.items
                .map(
                  (item) => `<li>${escapeHtml(item.title)} / ${escapeHtml(item.quantity)} / 追加者: ${escapeHtml(item.createdByName)} / リマインド日: ${escapeHtml(item.remindOn ?? item.dueDate ?? "未設定")} / 期限: ${escapeHtml(item.dueDate ?? "未設定")}</li>`,
                )
                .join("")}
            </ul>
          `,
        )
        .join("")}
    </div>
  `;
}

async function sendWithResend(payload: ResendPayload) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend API error: ${text}`);
  }

  return response.json();
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1" || url.searchParams.get("dryRun") === "true";
  const deliveryDate = url.searchParams.get("date") ?? todayKey();

  const d1 = await getD1Database();
  if (d1) {
    const listRows = await getD1ReminderLists(d1);
    const digests: ReminderDigest[] = [];
    let skipped = 0;
    let alreadySent = 0;

    for (const list of listRows) {
      const existingLog = await getD1ReminderLog(d1, list.id, deliveryDate);
      if (existingLog) {
        alreadySent += 1;
        continue;
      }

      const { members, items, profiles } = await getD1ReminderSnapshot(d1, list, deliveryDate);
      const snapshot = toSnapshot(list, members, items, profiles, deliveryDate);
      if (!snapshot) {
        skipped += 1;
        continue;
      }

      const recipients = [
        ...new Map(
          [snapshot.owner, ...snapshot.members]
            .filter((profile) => Boolean(profile.email))
            .map((profile) => [profile.email.toLowerCase(), profile]),
        ).values(),
      ];
      const digest = buildReminderDigest(snapshot, recipients, deliveryDate);
      if (!hasReminderTargets(digest)) {
        skipped += 1;
        if (!dryRun) {
          await upsertD1ReminderLog(d1, list.id, deliveryDate, "skipped", 0);
        }
        continue;
      }

      digests.push(digest);
    }

    if (dryRun || !process.env.RESEND_API_KEY || !process.env.REMINDER_FROM_EMAIL) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        sent: 0,
        skipped,
        alreadySent,
        preview: digests.map((digest) => ({
          listId: digest.listId,
          recipients: digest.recipients,
          dueToday: digest.itemGroup.dueToday.length,
          overdue: digest.itemGroup.overdue.length,
        })),
      });
    }

    await Promise.all(
      digests.map((digest) =>
        sendWithResend({
          from: process.env.REMINDER_FROM_EMAIL as string,
          to: digest.recipients,
          subject: `【買い物リマインド】${digest.listName}`,
          html: renderDigest(digest),
        }),
      ),
    );

    await Promise.all(
      digests.map((digest) => upsertD1ReminderLog(d1, digest.listId, deliveryDate, "sent", digest.recipients.length)),
    );

    return NextResponse.json({ ok: true, sent: digests.length, skipped, alreadySent });
  }

  return NextResponse.json({ error: "D1データベースに接続できません。" }, { status: 500 });
}

export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { digests?: ReminderDigest[]; dryRun?: boolean };
  const digests = body.digests ?? [];

  if (digests.length === 0) {
    return NextResponse.json({ ok: true, message: "No reminder digests provided.", sent: 0 });
  }

  if (body.dryRun || !process.env.RESEND_API_KEY || !process.env.REMINDER_FROM_EMAIL) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      preview: digests.map((digest) => ({
        listId: digest.listId,
        recipients: digest.recipients,
        dueToday: digest.itemGroup.dueToday.length,
        overdue: digest.itemGroup.overdue.length,
      })),
    });
  }

  await Promise.all(
    digests.map((digest) =>
      sendWithResend({
        from: process.env.REMINDER_FROM_EMAIL as string,
        to: digest.recipients,
        subject: `【買い物リマインド】${digest.listName}`,
        html: renderDigest(digest),
      }),
    ),
  );

  return NextResponse.json({ ok: true, sent: digests.length });
}
