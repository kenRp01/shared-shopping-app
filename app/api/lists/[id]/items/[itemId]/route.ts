import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { createItemSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ id: string; itemId: string }>;
};

async function authorize(request: NextRequest, listId: string) {
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

  const { data: list, error: listError } = await admin.from("shopping_lists").select("id,owner_user_id").eq("id", listId).single();
  if (listError || !list) {
    return { error: NextResponse.json({ error: "リストが見つかりません。" }, { status: 404 }) };
  }

  const { data: members, error: memberError } = await admin.from("shopping_list_members").select("user_id").eq("list_id", listId);
  if (memberError) {
    return { error: NextResponse.json({ error: memberError.message }, { status: 500 }) };
  }

  const canEdit = list.owner_user_id === viewer.id || (members ?? []).some((member) => member.user_id === viewer.id);
  if (!canEdit) {
    return { error: NextResponse.json({ error: "このリストを編集する権限がありません。" }, { status: 403 }) };
  }

  return { admin, viewer };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id: listId, itemId } = await context.params;
  const auth = await authorize(request, listId);
  if (auth.error) {
    return auth.error;
  }

  const body = (await request.json().catch(() => ({}))) as {
    toggleStatus?: boolean;
    payload?: unknown;
    nextListId?: string;
  };

  const { data: currentItem, error: itemError } = await auth.admin
    .from("shopping_items")
    .select("*")
    .eq("id", itemId)
    .eq("list_id", listId)
    .single();

  if (itemError || !currentItem) {
    return NextResponse.json({ error: "商品が見つかりません。" }, { status: 404 });
  }

  if (body.toggleStatus) {
    const nextStatus = currentItem.status === "pending" ? "purchased" : "pending";
    const { error } = await auth.admin
      .from("shopping_items")
      .update({
        status: nextStatus,
        purchased_by_user_id: nextStatus === "purchased" ? auth.viewer.id : null,
        updated_by_user_id: auth.viewer.id,
      })
      .eq("id", itemId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const result = createItemSchema.safeParse(body.payload);
  if (!result.success) {
    return NextResponse.json({ error: "商品情報を確認してください。" }, { status: 400 });
  }

  const destinationListId = body.nextListId ?? listId;
  if (destinationListId !== listId) {
    const destinationAuth = await authorize(request, destinationListId);
    if (destinationAuth.error) {
      return destinationAuth.error;
    }
  }

  const { error } = await auth.admin
    .from("shopping_items")
    .update({
      list_id: destinationListId,
      title: result.data.title,
      quantity: result.data.quantity,
      note: result.data.note,
      scope: result.data.scope,
      due_date: result.data.dueDate,
      due_time: result.data.dueTime,
      remind_on: result.data.remindOn,
      reminder_enabled: result.data.reminderEnabled,
      updated_by_user_id: auth.viewer.id,
    })
    .eq("id", itemId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await auth.admin.from("shopping_lists").update({ updated_at: new Date().toISOString() }).in("id", [listId, destinationListId]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id: listId, itemId } = await context.params;
  const auth = await authorize(request, listId);
  if (auth.error) {
    return auth.error;
  }

  const { error } = await auth.admin.from("shopping_items").delete().eq("id", itemId).eq("list_id", listId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await auth.admin.from("shopping_lists").update({ updated_at: new Date().toISOString() }).eq("id", listId);
  return NextResponse.json({ ok: true });
}
