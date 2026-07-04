import { NextRequest, NextResponse } from "next/server";
import { getBearerViewer } from "@/lib/api-auth";
import { deleteD1List, getD1ListSnapshot, updateD1ListSettings } from "@/lib/d1";
import { updateReminderSettingsSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await getBearerViewer(request);
  if (auth.error) {
    return auth.error;
  }
  const { id: listId } = await context.params;

  try {
    const snapshot = await getD1ListSnapshot(auth.db, auth.viewer.id, listId, {
      settingsOnly: request.nextUrl.searchParams.get("view") === "settings",
      includeCategories: request.nextUrl.searchParams.get("view") !== "settings",
    });
    if (!snapshot) {
      return NextResponse.json({ error: "リストが見つかりません。" }, { status: 404 });
    }
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "このリストを表示できません。" }, { status: 403 });
    }
    return NextResponse.json({ error: "リストを取得できませんでした。" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await getBearerViewer(request);
  if (auth.error) {
    return auth.error;
  }
  const result = updateReminderSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: "通知設定を確認してください。" }, { status: 400 });
  }
  const { id: listId } = await context.params;
  const updated = await updateD1ListSettings(auth.db, auth.viewer.id, listId, result.data);
  if (updated.status !== 200) {
    return NextResponse.json({ error: updated.error }, { status: updated.status });
  }
  return NextResponse.json({ ok: true, publicToken: updated.publicToken });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await getBearerViewer(request);
  if (auth.error) {
    return auth.error;
  }
  const { id: listId } = await context.params;
  const deleted = await deleteD1List(auth.db, auth.viewer.id, listId);
  if (deleted.status !== 200) {
    return NextResponse.json({ error: deleted.error }, { status: deleted.status });
  }
  return NextResponse.json({ ok: true });
}
