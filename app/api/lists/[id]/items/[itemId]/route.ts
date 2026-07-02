import { NextRequest, NextResponse } from "next/server";
import { getBearerViewer } from "@/lib/api-auth";
import { deleteD1Item, updateD1Item } from "@/lib/d1";
import { createItemSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await getBearerViewer(request);
  if (auth.error) {
    return auth.error;
  }
  const { id: listId, itemId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    toggleStatus?: boolean;
    payload?: unknown;
    nextListId?: string;
  };

  if (body.toggleStatus) {
    const updated = await updateD1Item(auth.db, auth.viewer.id, listId, itemId, { toggleStatus: true });
    return updated.status === 200
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: updated.error }, { status: updated.status });
  }

  const result = createItemSchema.safeParse(body.payload);
  if (!result.success) {
    return NextResponse.json({ error: "商品情報を確認してください。" }, { status: 400 });
  }
  const updated = await updateD1Item(auth.db, auth.viewer.id, listId, itemId, {
    payload: result.data,
    nextListId: body.nextListId,
  });
  return updated.status === 200
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: updated.error }, { status: updated.status });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await getBearerViewer(request);
  if (auth.error) {
    return auth.error;
  }
  const { id: listId, itemId } = await context.params;
  const deleted = await deleteD1Item(auth.db, auth.viewer.id, listId, itemId);
  return deleted.status === 200
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: deleted.error }, { status: deleted.status });
}
