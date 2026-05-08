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

  const [{ data: ownedListRows, error: ownedListError }, { data: viewerMemberRows, error: viewerMemberError }] = await Promise.all([
    admin.from("shopping_lists").select("*").eq("owner_user_id", viewer!.id),
    admin.from("shopping_list_members").select("*").eq("user_id", viewer!.id),
  ]);

  if (ownedListError || viewerMemberError) {
    return NextResponse.json(
      { error: ownedListError?.message || viewerMemberError?.message || "リストを取得できませんでした。" },
      { status: 500 },
    );
  }

  const memberListIds = [...new Set((viewerMemberRows ?? []).map((member) => member.list_id))];
  const { data: memberListRows, error: memberListError } = memberListIds.length
    ? await admin.from("shopping_lists").select("*").in("id", memberListIds)
    : { data: [], error: null };

  if (memberListError) {
    return NextResponse.json({ error: memberListError.message }, { status: 500 });
  }

  const listMap = new Map<string, NonNullable<typeof ownedListRows>[number]>();
  for (const list of ownedListRows ?? []) {
    listMap.set(list.id, list);
  }
  for (const list of memberListRows ?? []) {
    listMap.set(list.id, list);
  }

  const lists = [...listMap.values()].sort((left, right) => right.updated_at.localeCompare(left.updated_at));
  const listIds = lists.map((list) => list.id);
  const [membersResult, itemsResult] = listIds.length
    ? await Promise.all([
        admin.from("shopping_list_members").select("*").in("list_id", listIds),
        admin
          .from("shopping_items")
          .select("id,list_id,status,scope,due_date,remind_on,reminder_enabled,created_by_user_id")
          .in("list_id", listIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];

  if (membersResult.error || itemsResult.error) {
    return NextResponse.json(
      { error: membersResult.error?.message || itemsResult.error?.message || "リストを取得できませんでした。" },
      { status: 500 },
    );
  }

  const visibleMembers = membersResult.data ?? [];
  const visibleItems = itemsResult.data ?? [];
  const profileIds = new Set<string>();
  for (const list of lists) {
    profileIds.add(list.owner_user_id);
  }
  for (const member of visibleMembers) {
    profileIds.add(member.user_id);
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
