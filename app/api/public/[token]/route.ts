import { NextResponse } from "next/server";
import { getD1Database, getD1PublicSnapshot } from "@/lib/d1";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const db = await getD1Database();
  if (!db) {
    return NextResponse.json({ error: "D1データベースに接続できません。" }, { status: 500 });
  }
  const { token } = await context.params;
  const snapshot = await getD1PublicSnapshot(db, token);
  return snapshot
    ? NextResponse.json(snapshot)
    : NextResponse.json({ error: "公開リストが見つかりません。" }, { status: 404 });
}
