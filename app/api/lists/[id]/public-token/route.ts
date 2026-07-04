import { NextRequest, NextResponse } from "next/server";
import { getBearerViewer } from "@/lib/api-auth";
import { rotateD1PublicToken } from "@/lib/d1";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await getBearerViewer(request);
  if (auth.error) {
    return auth.error;
  }
  const { id: listId } = await context.params;
  const rotated = await rotateD1PublicToken(auth.db, auth.viewer.id, listId);
  return rotated.status === 200
    ? NextResponse.json({ token: rotated.token })
    : NextResponse.json({ error: rotated.error }, { status: rotated.status });
}
