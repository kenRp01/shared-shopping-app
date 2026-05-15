import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { inviteTokenSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase の管理キーが設定されていません。" }, { status: 500 });
  }

  const authToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!authToken) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const { data: authData, error: authError } = await admin.auth.getUser(authToken);
  const viewer = authData.user;
  if (authError || !viewer?.email) {
    return NextResponse.json({ error: "ログイン情報を確認できませんでした。" }, { status: 401 });
  }

  const params = await context.params;
  const parsed = inviteTokenSchema.safeParse({ token: params.token });
  if (!parsed.success) {
    return NextResponse.json({ error: "招待リンクを確認してください。" }, { status: 400 });
  }

  const { data: invite, error: inviteError } = await admin
    .from("shopping_list_invites")
    .select("list_id,enabled")
    .eq("token", parsed.data.token)
    .eq("enabled", true)
    .single();

  if (inviteError || !invite?.enabled) {
    return NextResponse.json({ error: "招待リンクが見つかりません。" }, { status: 404 });
  }

  const { data: list, error: listError } = await admin
    .from("shopping_lists")
    .select("id,owner_user_id")
    .eq("id", invite.list_id)
    .single();

  if (listError || !list) {
    return NextResponse.json({ error: "リストが見つかりません。" }, { status: 404 });
  }

  if (list.owner_user_id !== viewer.id) {
    const { error: memberError } = await admin.from("shopping_list_members").upsert(
      {
        list_id: list.id,
        user_id: viewer.id,
        role: "editor",
        invited_by_user_id: list.owner_user_id,
      },
      { onConflict: "list_id,user_id" },
    );
    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }
  }

  await admin.from("shopping_lists").update({ visibility: "shared" }).eq("id", list.id);

  return NextResponse.json({ listId: list.id });
}
