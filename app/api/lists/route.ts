import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { createListSchema } from "@/lib/validation";
import { makeId } from "@/lib/utils";

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

export async function GET(request: NextRequest) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase の管理キーが設定されていません。" }, { status: 500 });
  }

  const { viewer, error } = await getViewer(request, admin);
  if (error) {
    return error;
  }

  const [{ data: listRows, error: listError }, { data: memberRows, error: memberError }, { data: itemRows, error: itemError }] =
    await Promise.all([
      admin.from("shopping_lists").select("*").order("updated_at", { ascending: false }),
      admin.from("shopping_list_members").select("*"),
      admin.from("shopping_items").select("*"),
    ]);

  if (listError || memberError || itemError) {
    return NextResponse.json(
      { error: listError?.message || memberError?.message || itemError?.message || "リストを取得できませんでした。" },
      { status: 500 },
    );
  }

  const members = memberRows ?? [];
  const lists = (listRows ?? []).filter(
    (list) => list.owner_user_id === viewer!.id || members.some((member) => member.list_id === list.id && member.user_id === viewer!.id),
  );
  const listIds = new Set(lists.map((list) => list.id));
  const visibleMembers = members.filter((member) => listIds.has(member.list_id));
  const visibleItems = (itemRows ?? []).filter((item) => listIds.has(item.list_id));
  const profileIds = new Set<string>();
  for (const list of lists) {
    profileIds.add(list.owner_user_id);
  }
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

  const { data: profiles, error: profileError } = profileIds.size
    ? await admin.from("profiles").select("*").in("id", [...profileIds])
    : { data: [], error: null };

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ lists, members: visibleMembers, items: visibleItems, profiles: profiles ?? [] });
}

export async function POST(request: NextRequest) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase の管理キーが設定されていません。" }, { status: 500 });
  }

  const { viewer, error } = await getViewer(request, admin);
  if (error) {
    return error;
  }

  const body = await request.json().catch(() => null);
  const result = createListSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "リスト名と通知設定を確認してください。" }, { status: 400 });
  }

  const metadataName =
    typeof viewer!.user_metadata?.name === "string"
      ? viewer!.user_metadata.name
      : typeof viewer!.user_metadata?.full_name === "string"
        ? viewer!.user_metadata.full_name
        : "";
  const name = metadataName || viewer!.email!.split("@")[0] || "ユーザー";

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: viewer!.id,
      email: viewer!.email!.toLowerCase(),
      name,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { data: list, error: listError } = await admin
    .from("shopping_lists")
    .insert({
      name: result.data.name,
      description: result.data.description,
      planned_date: result.data.plannedDate,
      visibility: result.data.visibility,
      owner_user_id: viewer!.id,
      public_token: result.data.visibility === "public_link" ? makeId("public") : null,
      daily_reminder_enabled: result.data.dailyReminderEnabled,
      daily_reminder_hour: result.data.dailyReminderHour,
    })
    .select("*")
    .single();

  if (listError || !list) {
    return NextResponse.json({ error: listError?.message || "リストを作成できませんでした。" }, { status: 500 });
  }

  const { error: memberError } = await admin.from("shopping_list_members").upsert(
    {
      list_id: list.id,
      user_id: viewer!.id,
      role: "owner",
      invited_by_user_id: viewer!.id,
    },
    { onConflict: "list_id,user_id" },
  );

  if (memberError) {
    await admin.from("shopping_lists").delete().eq("id", list.id);
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({ list });
}
