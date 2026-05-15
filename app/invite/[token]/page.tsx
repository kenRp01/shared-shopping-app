"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { acceptListInvite, getCurrentUser } from "@/lib/local-store";

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [message, setMessage] = useState("共有リストに参加しています。");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const user = await getCurrentUser();
        if (!user || user.email.endsWith("@shareshopi.local")) {
          setNeedsLogin(true);
          setMessage("共有リストに参加するにはログインしてください。");
          return;
        }

        const { listId } = await acceptListInvite(params.token, user);
        router.replace(`/lists/${listId}`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "招待リンクを開けませんでした。");
      }
    });
  }, [params.token, router]);

  return (
    <section className="panel">
      <p className="eyebrow">Invite</p>
      <h2>共有リスト</h2>
      <p className="lead-copy">{message}</p>
      {needsLogin ? (
        <Link href="/login" className="primary-button compact-button">
          ログインする
        </Link>
      ) : null}
    </section>
  );
}
