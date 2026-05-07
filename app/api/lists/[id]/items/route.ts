import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { createItemSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getViewerAndList(request: NextRequest, listId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { error: NextResponse.json({ error: "Supabase の管理キーが設定されていません。" }, { status: 500 }) };
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { error: NextResponse.json({ error: "ログインが必要です。" }, { status: 401 }) };
  }

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const viewer = authData.user;
  if (authError || !viewer?.email) {
    return { error: NextResponse.json({ error: "ログイン情報を確認できませんでした。" }, { status: 401 }) };
  }

  const { data: list, error: listError } = await admin.from("shopping_lists").select("*").eq("id", listId).single();
  if (listError || !list) {
    return { error: NextResponse.json({ error: "リストが見つかりません。" }, { status: 404 }) };
  }

  const { data: members, error: memberError } = await admin.from("shopping_list_members").select("*").eq("list_id", listId);
  if (memberError) {
    return { error: NextResponse.json({ error: memberError.message }, { status: 500 }) };
  }

  const canEdit = list.owner_user_id === viewer.id || (members ?? []).some((member) => member.user_id === viewer.id);
  if (!canEdit) {
    return { error: NextResponse.json({ error: "このリストを編集する権限がありません。" }, { status: 403 }) };
  }

  return { admin, viewer, list };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: listId } = await context.params;
  const auth = await getViewerAndList(request, listId);
  if (auth.error) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const result = createItemSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "商品名や期限の入力を確認してください。" }, { status: 400 });
  }

  const { data: item, error } = await auth.admin
    .from("shopping_items")
    .insert({
      list_id: listId,
      title: result.data.title,
      quantity: result.data.quantity,
      note: result.data.note,
      status: "pending",
      scope: result.data.scope,
      due_date: result.data.dueDate,
      due_time: result.data.dueTime,
      remind_on: result.data.remindOn,
      reminder_enabled: result.data.reminderEnabled,
      created_by_user_id: auth.viewer.id,
      updated_by_user_id: auth.viewer.id,
    })
    .select("*")
    .single();

  if (error || !item) {
    return NextResponse.json({ error: error?.message || "商品を追加できませんでした。" }, { status: 500 });
  }

  await auth.admin.from("shopping_lists").update({ updated_at: new Date().toISOString() }).eq("id", listId);
  return NextResponse.json({ item });
}
