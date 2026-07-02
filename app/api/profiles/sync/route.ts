import { NextRequest, NextResponse } from "next/server";
import { getBearerViewer } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const auth = await getBearerViewer(request);
  if (auth.error) {
    return auth.error;
  }
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = body.name?.trim();
  if (name && name.length > 40) {
    return NextResponse.json({ error: "表示名は40文字以内で入力してください。" }, { status: 400 });
  }
  if (name && name !== auth.viewer.user_metadata.name) {
    await auth.db.prepare("UPDATE profiles SET name = ? WHERE id = ?").bind(name, auth.viewer.id).run();
  }
  const profile = await auth.db.prepare("SELECT * FROM profiles WHERE id = ?").bind(auth.viewer.id).first();
  return NextResponse.json({ profile });
}
