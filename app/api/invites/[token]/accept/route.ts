import { NextRequest, NextResponse } from "next/server";
import { getBearerViewer } from "@/lib/api-auth";
import { acceptD1Invite } from "@/lib/d1";
import { inviteTokenSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await getBearerViewer(request);
  if (auth.error) {
    return auth.error;
  }
  const parsed = inviteTokenSchema.safeParse(await context.params);
  if (!parsed.success) {
    return NextResponse.json({ error: "招待リンクを確認してください。" }, { status: 400 });
  }
  const accepted = await acceptD1Invite(auth.db, auth.viewer.id, parsed.data.token);
  return accepted.status === 200
    ? NextResponse.json({ listId: accepted.listId })
    : NextResponse.json({ error: accepted.error }, { status: accepted.status });
}
