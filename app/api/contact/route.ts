import { NextResponse } from "next/server";
import { contactMessageSchema } from "@/lib/validation";

const SUPPORT_EMAIL = "yqxxnaxr1109@gmail.com";
const SUBJECT_PREFIX = "ShareShopi問い合わせ";

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

function renderContactMessage(name: string, email: string, message: string) {
  return `
    <div style="font-family: sans-serif; line-height: 1.7;">
      <h2>ShareShopi 問い合わせ</h2>
      <p><strong>名前:</strong> ${escapeHtml(name)}</p>
      <p><strong>返信先:</strong> ${escapeHtml(email)}</p>
      <hr />
      <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
    </div>
  `;
}

async function sendWithResend(payload: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  reply_to: string;
}) {
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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = contactMessageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "入力内容を確認してください。" }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY || !process.env.REMINDER_FROM_EMAIL) {
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({ ok: true, dryRun: true });
    }

    return NextResponse.json(
      { error: "メール送信設定が未完了です。時間をおいて再度お試しください。" },
      { status: 503 },
    );
  }

  const { name, email, message } = parsed.data;

  try {
    await sendWithResend({
      from: process.env.REMINDER_FROM_EMAIL,
      to: [SUPPORT_EMAIL],
      subject: `${SUBJECT_PREFIX}: ${name}`,
      html: renderContactMessage(name, email, message),
      reply_to: email,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "送信できませんでした。時間をおいて再度お試しください。" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
