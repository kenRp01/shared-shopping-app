import { NextRequest, NextResponse } from "next/server";
import { sortSupabaseListsByCreatedAt } from "@/lib/list-order";
import { createSupabaseAdminClient } from "@/lib/supabase";

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

  const lists = sortSupabaseListsByCreatedAt([...listMap.values()]);
  const listIds = lists.map((list) => list.id);
  const [membersResult, overviewItemsResult] = listIds.length
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

  if (membersResult.error || overviewItemsResult.error) {
    return NextResponse.json(
      { error: membersResult.error?.message || overviewItemsResult.error?.message || "リストを取得できませんでした。" },
      { status: 500 },
    );
  }

  if (!lists.length) {
    return NextResponse.json({
      list: null,
      members: [],
      items: [],
      profiles: [],
      categories: { lists: [], members: [], items: [], profiles: [] },
    });
  }

  const list = lists[0];
  const [{ data: detailMembers, error: detailMemberError }, { data: detailItems, error: detailItemError }] = await Promise.all([
    admin.from("shopping_list_members").select("*").eq("list_id", list.id),
    admin.from("shopping_items").select("*").eq("list_id", list.id),
  ]);

  if (detailMemberError || detailItemError) {
    return NextResponse.json(
      { error: detailMemberError?.message || detailItemError?.message || "リストを取得できませんでした。" },
      { status: 500 },
    );
  }

  const profileIds = new Set<string>();
  for (const categoryList of lists) {
    profileIds.add(categoryList.owner_user_id);
  }
  for (const member of membersResult.data ?? []) {
    profileIds.add(member.user_id);
  }
  for (const item of detailItems ?? []) {
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

  return NextResponse.json({
    list,
    members: detailMembers ?? [],
    items: detailItems ?? [],
    profiles: profiles ?? [],
    categories: {
      lists,
      members: membersResult.data ?? [],
      items: overviewItemsResult.data ?? [],
      profiles: profiles ?? [],
    },
  });
}
