import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { updateReminderSettingsSchema } from "@/lib/validation";
import { makeId } from "@/lib/utils";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase の管理キーが設定されていません。" }, { status: 500 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const viewer = authData.user;
  if (authError || !viewer?.email) {
    return NextResponse.json({ error: "ログイン情報を確認できませんでした。" }, { status: 401 });
  }

  const { id: listId } = await context.params;
  const { data: list, error: listError } = await admin
    .from("shopping_lists")
    .select("*")
    .eq("id", listId)
    .single();

  if (listError || !list) {
    return NextResponse.json({ error: "リストが見つかりません。" }, { status: 404 });
  }

  const [{ data: members, error: memberError }, { data: items, error: itemError }] = await Promise.all([
    admin.from("shopping_list_members").select("*").eq("list_id", listId),
    admin.from("shopping_items").select("*").eq("list_id", listId),
  ]);

  if (memberError || itemError) {
    return NextResponse.json({ error: memberError?.message || itemError?.message || "リストを取得できませんでした。" }, { status: 500 });
  }

  const visibleMembers = members ?? [];
  const canView = list.owner_user_id === viewer.id || visibleMembers.some((member) => member.user_id === viewer.id);
  if (!canView) {
    return NextResponse.json({ error: "このリストを表示できません。" }, { status: 403 });
  }

  const visibleItems = items ?? [];
  const profileIds = new Set<string>([list.owner_user_id]);
  for (const member of visibleMembers) {
    profileIds.add(member.user_id);
  }
  for (const item of visibleItems) {
    profileIds.add(item.created_by_user_id);
    profileIds.add(item.updated_by_user_id);
    if (item.purchased_by_user_id) {
      profileIds.add(item.purchased_by_user_id);
    }
  }

  const { data: profiles, error: profileError } = await admin.from("profiles").select("*").in("id", [...profileIds]);
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ list, members: visibleMembers, items: visibleItems, profiles: profiles ?? [] });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase の管理キーが設定されていません。" }, { status: 500 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const viewer = authData.user;
  if (authError || !viewer?.email) {
    return NextResponse.json({ error: "ログイン情報を確認できませんでした。" }, { status: 401 });
  }

  const { id: listId } = await context.params;
  const body = await request.json().catch(() => null);
  const result = updateReminderSettingsSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "通知設定を確認してください。" }, { status: 400 });
  }

  const { data: list, error: listError } = await admin
    .from("shopping_lists")
    .select("id,owner_user_id,public_token")
    .eq("id", listId)
    .single();

  if (listError || !list) {
    return NextResponse.json({ error: "リストが見つかりません。" }, { status: 404 });
  }
  if (list.owner_user_id !== viewer.id) {
    return NextResponse.json({ error: "共有設定を変更できるのは所有者だけです。" }, { status: 403 });
  }

  const { error } = await admin
    .from("shopping_lists")
    .update({
      visibility: result.data.publicEnabled ? "public_link" : result.data.visibility,
      public_token: result.data.publicEnabled ? list.public_token ?? makeId("public") : null,
      daily_reminder_enabled: result.data.dailyReminderEnabled,
      daily_reminder_hour: result.data.dailyReminderHour,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
