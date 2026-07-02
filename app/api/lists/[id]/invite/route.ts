import { NextRequest, NextResponse } from "next/server";
import { getBearerViewer } from "@/lib/api-auth";
import { createD1Invite } from "@/lib/d1";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await getBearerViewer(request);
  if (auth.error) {
    return auth.error;
  }
  const { id: listId } = await context.params;
  const created = await createD1Invite(auth.db, auth.viewer.id, request.nextUrl.origin, listId);
  return created.status === 200
    ? NextResponse.json({ invite: created.invite })
    : NextResponse.json({ error: created.error }, { status: created.status });
}
