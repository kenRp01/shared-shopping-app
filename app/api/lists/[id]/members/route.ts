import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
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
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "共有先のメールアドレスを確認してください。" }, { status: 400 });
  }

  const { data: list, error: listError } = await admin
    .from("shopping_lists")
    .select("id,owner_user_id")
    .eq("id", listId)
    .single();

  if (listError || !list) {
    return NextResponse.json({ error: "リストが見つかりません。" }, { status: 404 });
  }
  if (list.owner_user_id !== viewer.id) {
    return NextResponse.json({ error: "共有メンバーを追加できるのは所有者だけです。" }, { status: 403 });
  }

  let { data: target, error: targetError } = await admin
    .from("profiles")
    .select("id,email,name")
    .eq("email", email)
    .single();

  if (targetError || !target) {
    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }
    const authUser = usersData.users.find((user) => user.email?.toLowerCase() === email);
    if (!authUser?.email) {
      return NextResponse.json({ error: "先に相手がログインまたは新規登録を完了する必要があります。" }, { status: 404 });
    }

    const metadataName =
      typeof authUser.user_metadata?.name === "string"
        ? authUser.user_metadata.name
        : typeof authUser.user_metadata?.full_name === "string"
          ? authUser.user_metadata.full_name
          : "";
    const name = metadataName || authUser.email.split("@")[0] || "ユーザー";
    const { data: createdProfile, error: profileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: authUser.id,
          email: authUser.email.toLowerCase(),
          name,
        },
        { onConflict: "id" },
      )
      .select("id,email,name")
      .single();

    if (profileError || !createdProfile) {
      return NextResponse.json({ error: profileError?.message || "共有先ユーザーを登録できませんでした。" }, { status: 500 });
    }
    target = createdProfile;
  }
  if (target.id === viewer.id) {
    return NextResponse.json({ error: "自分自身はすでに所有者です。" }, { status: 400 });
  }

  const { error: memberError } = await admin.from("shopping_list_members").upsert(
    {
      list_id: listId,
      user_id: target.id,
      role: "editor",
      invited_by_user_id: viewer.id,
    },
    { onConflict: "list_id,user_id" },
  );

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  await admin.from("shopping_lists").update({ visibility: "shared" }).eq("id", listId);

  return NextResponse.json({ member: target });
}
