import { NextRequest, NextResponse } from "next/server";
import { getBearerViewer } from "@/lib/api-auth";
import { addD1ListMember, findD1ProfileByEmail } from "@/lib/d1";
import { shareMemberSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await getBearerViewer(request);
  if (auth.error) {
    return auth.error;
  }
  const result = shareMemberSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: "共有先のメールアドレスを確認してください。" }, { status: 400 });
  }
  const target = await findD1ProfileByEmail(auth.db, result.data.email);
  if (!target) {
    return NextResponse.json(
      { error: "先に相手がFirebaseでログインまたは新規登録を完了する必要があります。" },
      { status: 404 },
    );
  }
  const { id: listId } = await context.params;
  const added = await addD1ListMember(auth.db, auth.viewer.id, listId, target);
  return added.status === 200
    ? NextResponse.json({ member: target })
    : NextResponse.json({ error: added.error }, { status: added.status });
}
