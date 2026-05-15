import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { makeId } from "@/lib/utils";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getViewer(request: NextRequest, admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { error: NextResponse.json({ error: "ログインが必要です。" }, { status: 401 }) };
  }

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const viewer = authData.user;
  if (authError || !viewer?.email) {
    return { error: NextResponse.json({ error: "ログイン情報を確認できませんでした。" }, { status: 401 }) };
  }

  return { viewer };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase の管理キーが設定されていません。" }, { status: 500 });
  }

  const { viewer, error } = await getViewer(request, admin);
  if (error) {
    return error;
  }

  const { id: listId } = await context.params;
  const { data: list, error: listError } = await admin
    .from("shopping_lists")
    .select("id,owner_user_id")
    .eq("id", listId)
    .single();

  if (listError || !list) {
    return NextResponse.json({ error: "リストが見つかりません。" }, { status: 404 });
  }
  if (list.owner_user_id !== viewer!.id) {
    return NextResponse.json({ error: "招待リンクを作成できるのは所有者だけです。" }, { status: 403 });
  }

  const { data: existing, error: existingError } = await admin
    .from("shopping_list_invites")
    .select("token")
    .eq("list_id", listId)
    .eq("enabled", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const token = existing?.token ?? makeId("invite");
  if (!existing?.token) {
    const { error: inviteError } = await admin.from("shopping_list_invites").insert({
      list_id: listId,
      token,
      enabled: true,
      created_by_user_id: viewer!.id,
    });
    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 500 });
    }
  }

  await admin.from("shopping_lists").update({ visibility: "shared" }).eq("id", listId);

  return NextResponse.json({
    invite: {
      token,
      url: `${request.nextUrl.origin}/invite/${token}`,
    },
  });
}
