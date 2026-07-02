import { NextRequest, NextResponse } from "next/server";
import { getBearerViewer } from "@/lib/api-auth";
import { createD1Item } from "@/lib/d1";
import { createItemSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await getBearerViewer(request);
  if (auth.error) {
    return auth.error;
  }
  const result = createItemSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: "商品名や期限の入力を確認してください。" }, { status: 400 });
  }
  const { id: listId } = await context.params;
  const created = await createD1Item(auth.db, auth.viewer.id, listId, result.data);
  if (created.status !== 200 || !created.item) {
    const message = "error" in created ? created.error : "商品を追加できませんでした。";
    return NextResponse.json(
      { error: message },
      { status: created.status === 200 ? 500 : created.status },
    );
  }
  return NextResponse.json({ item: created.item });
}
