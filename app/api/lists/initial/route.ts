import { NextRequest, NextResponse } from "next/server";
import { getBearerViewer } from "@/lib/api-auth";
import { getD1AccessibleCategories, getD1ListSnapshot } from "@/lib/d1";

export async function GET(request: NextRequest) {
  const auth = await getBearerViewer(request);
  if (auth.error) {
    return auth.error;
  }

  const categories = await getD1AccessibleCategories(auth.db, auth.viewer.id);
  if (!categories.lists.length) {
    return NextResponse.json({ list: null, members: [], items: [], profiles: [], categories });
  }

  const snapshot = await getD1ListSnapshot(auth.db, auth.viewer.id, categories.lists[0].id, {
    includeCategories: true,
  });
  return NextResponse.json(snapshot ?? { list: null, members: [], items: [], profiles: [], categories });
}
