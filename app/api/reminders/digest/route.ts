import { NextResponse } from "next/server";
import type { ReminderDigest } from "@/lib/types";

type ResendPayload = {
  from: string;
  to: string[];
  subject: string;
  html: string;
};

function renderDigest(digest: ReminderDigest) {
  const sections = [
    { title: "今日が期限", items: digest.itemGroup.dueToday },
    { title: "期限切れ", items: digest.itemGroup.overdue },
  ].filter((section) => section.items.length > 0);

  return `
    <div style="font-family: sans-serif; line-height: 1.6;">
      <h2>${digest.listName} の買い物リマインド</h2>
      <p>${digest.hourLabel} 頃に送る想定のまとめ通知です。</p>
      ${sections
        .map(
          (section) => `
            <h3>${section.title}</h3>
            <ul>
              ${section.items
                .map(
                  (item) => `<li>${item.title} / ${item.quantity} / 追加者: ${item.createdByName} / 期限: ${item.dueDate ?? "未設定"}</li>`,
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
  const secret = process.env.CRON_SECRET;
  const headerSecret = request.headers.get("x-cron-secret");
  if (secret && headerSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    message: "Cron endpoint is ready. Supply digests via POST or connect Supabase server-side collection.",
  });
}

export async function POST(request: Request) {
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
