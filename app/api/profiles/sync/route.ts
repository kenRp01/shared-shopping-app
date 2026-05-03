import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase の管理キーが設定されていません。" }, { status: 500 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData.user;
  if (authError || !user?.email) {
    return NextResponse.json({ error: "ログイン情報を確認できませんでした。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const metadataName =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : "";
  const name = body.name?.trim() || metadataName || user.email.split("@")[0] || "ユーザー";
  if (name.length > 40) {
    return NextResponse.json({ error: "表示名は40文字以内で入力してください。" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email.toLowerCase(),
        name,
      },
      { onConflict: "id" },
    )
    .select("id,email,name,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, name },
  });

  return NextResponse.json({ profile: data });
}
