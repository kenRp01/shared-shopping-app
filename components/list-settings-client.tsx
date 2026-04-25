"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { getCurrentUser, getListSnapshot, updateListSettings, addListMember } from "@/lib/local-store";
import type { ShoppingListSnapshot, UserProfile } from "@/lib/types";

type Props = {
  listId: string;
};

export function ListSettingsClient({ listId }: Props) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [snapshot, setSnapshot] = useState<ShoppingListSnapshot | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refresh(currentUser?: UserProfile | null) {
    const nextUser = currentUser ?? (await getCurrentUser());
    setUser(nextUser);
    if (nextUser) {
      setSnapshot(await getListSnapshot(listId, nextUser.id));
    }
  }

  useEffect(() => {
    refresh();
  }, [listId]);

  if (!snapshot || snapshot.permission !== "edit") {
    return (
      <section className="panel">
        <p className="eyebrow">Unavailable</p>
        <h2>設定を表示できません</h2>
      </section>
    );
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <p className="eyebrow">List Settings</p>
        <h2>{snapshot.list.name} の共有設定</h2>
        <p className="compact-copy">共有メンバー追加と公開リンク、毎日の通知時刻をここで管理します。</p>
      </section>

      <form
        className="panel form-panel"
        action={(formData) => {
          startTransition(async () => {
            try {
              if (!user) {
                throw new Error("ログインが必要です。");
              }
              await updateListSettings(listId, user, {
                dailyReminderEnabled: formData.get("dailyReminderEnabled") === "on",
                dailyReminderHour: String(formData.get("dailyReminderHour") ?? "08:00"),
                visibility: String(formData.get("visibility") ?? "shared") as "private" | "shared" | "public_link",
                publicEnabled: formData.get("publicEnabled") === "on",
              });
              await refresh(user);
              setMessage("設定を更新しました。");
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "設定更新に失敗しました。");
            }
          });
        }}
      >
        <div className="compact-heading">
          <p className="eyebrow">Reminder</p>
          <h2>通知と公開範囲</h2>
        </div>
        <label className="checkbox-row">
          <input name="dailyReminderEnabled" type="checkbox" defaultChecked={snapshot.list.dailyReminderEnabled} />
          毎日まとめてリマインドする
        </label>
        <label>
          通知時刻
          <input name="dailyReminderHour" type="time" defaultValue={snapshot.list.dailyReminderHour} />
        </label>
        <label>
          基本の公開範囲
          <select name="visibility" defaultValue={snapshot.list.visibility}>
            <option value="private">自分のみ</option>
            <option value="shared">共有メンバー</option>
            <option value="public_link">公開リンク</option>
          </select>
        </label>
        <label className="checkbox-row">
          <input name="publicEnabled" type="checkbox" defaultChecked={Boolean(snapshot.list.publicToken)} />
          公開リンクを有効化する
        </label>
        {snapshot.list.publicToken ? (
          <div className="demo-box">
            <strong>公開URL</strong>
            <p>/public/{snapshot.list.publicToken}</p>
            <Link href={`/public/${snapshot.list.publicToken}`} className="text-link">公開ページを開く</Link>
          </div>
        ) : null}
        {message ? <p className="notice-inline">{message}</p> : null}
        <button type="submit" className="primary-button" disabled={isPending}>
          {isPending ? "保存中..." : "設定を保存"}
        </button>
      </form>

      <form
        className="panel form-panel"
        action={() => {
          startTransition(async () => {
            try {
              if (!user) {
                throw new Error("ログインが必要です。");
              }
              await addListMember(listId, shareEmail, user);
              setShareEmail("");
              await refresh(user);
              setMessage("共有メンバーを追加しました。");
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "共有追加に失敗しました。");
            }
          });
        }}
      >
        <div className="compact-heading">
          <p className="eyebrow">Members</p>
          <h2>共有メンバー</h2>
        </div>
        <label>
          登録済みユーザーのメールアドレス
          <input type="email" value={shareEmail} onChange={(event) => setShareEmail(event.target.value)} placeholder="takumi@example.com" />
        </label>
        <button type="submit" className="primary-button" disabled={isPending}>共有メンバーに追加</button>
        <div className="member-list">
          {snapshot.members.map((member) => (
            <div className="member-row" key={member.id}>
              <div>
                <strong>{member.name}</strong>
                <p>{member.email}</p>
              </div>
              <span className="tag">{member.role === "owner" ? "所有者" : "編集者"}</span>
            </div>
          ))}
        </div>
      </form>
    </div>
  );
}
