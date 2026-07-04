import { NextRequest, NextResponse } from "next/server";
import { getD1Database, resolveD1FirebaseProfile } from "@/lib/d1";
import { isFirebaseIdToken, UnverifiedFirebaseEmailError, verifyFirebaseIdToken } from "@/lib/firebase-token";

export type AuthViewer = {
  id: string;
  email: string;
  user_metadata: Record<string, unknown>;
  provider: "firebase";
};

export function viewerDisplayName(viewer: AuthViewer) {
  const metadataName =
    typeof viewer.user_metadata?.name === "string"
      ? viewer.user_metadata.name
      : typeof viewer.user_metadata?.full_name === "string"
        ? viewer.user_metadata.full_name
        : "";

  return metadataName || viewer.email?.split("@")[0] || "ユーザー";
}

export async function getBearerViewer(request: NextRequest | Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { error: NextResponse.json({ error: "ログインが必要です。" }, { status: 401 }) };
  }

  if (!isFirebaseIdToken(token)) {
    return { error: NextResponse.json({ error: "Firebase のログイン情報が必要です。" }, { status: 401 }) };
  }

  try {
    const firebaseViewer = await verifyFirebaseIdToken(token);
    if (!firebaseViewer.email) {
      return { error: NextResponse.json({ error: "メールアドレスを確認できませんでした。" }, { status: 401 }) };
    }
    const db = await getD1Database();
    if (!db) {
      return { error: NextResponse.json({ error: "D1データベースに接続できません。" }, { status: 500 }) };
    }
    const name = firebaseViewer.name || firebaseViewer.email.split("@")[0] || "ユーザー";
    const profile = await resolveD1FirebaseProfile(db, {
      uid: firebaseViewer.uid,
      email: firebaseViewer.email,
      name,
    });
    if (!profile) {
      return { error: NextResponse.json({ error: "ユーザー情報を同期できませんでした。" }, { status: 500 }) };
    }
    return {
      db,
      viewer: {
        id: profile.id,
        email: profile.email,
        user_metadata: { name: profile.name, picture: firebaseViewer.picture },
        provider: "firebase" as const,
      },
    };
  } catch (error) {
    if (error instanceof UnverifiedFirebaseEmailError) {
      return { error: NextResponse.json({ error: "メール認証を完了してからログインしてください。" }, { status: 403 }) };
    }
    return { error: NextResponse.json({ error: "ログイン情報を確認できませんでした。" }, { status: 401 }) };
  }
}
