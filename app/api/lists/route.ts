import { NextRequest, NextResponse } from "next/server";
import { getBearerViewer, viewerDisplayName } from "@/lib/api-auth";
import { createD1List, getD1AccessibleCategories } from "@/lib/d1";
import { createListSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const auth = await getBearerViewer(request);
  if (auth.error) {
    return auth.error;
  }

  const categories = await getD1AccessibleCategories(auth.db, auth.viewer.id);
  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  const auth = await getBearerViewer(request);
  if (auth.error) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const result = createListSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "リスト名と通知設定を確認してください。" }, { status: 400 });
  }

  const list = await createD1List(
    auth.db,
    { id: auth.viewer.id, email: auth.viewer.email, name: viewerDisplayName(auth.viewer) },
    result.data,
  );
  if (!list) {
    return NextResponse.json({ error: "リストを作成できませんでした。" }, { status: 500 });
  }
  return NextResponse.json({ list });
}
