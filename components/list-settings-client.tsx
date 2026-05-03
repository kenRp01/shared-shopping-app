"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { getCurrentUser, getListSnapshot, updateListSettings, addListMember, listAccessibleLists, removeList, updateUserProfile } from "@/lib/local-store";
import type { ShoppingListSnapshot, UserProfile } from "@/lib/types";

type Props = {
  listId: string;
};

export function ListSettingsClient({ listId }: Props) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [snapshot, setSnapshot] = useState<ShoppingListSnapshot | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [profileName, setProfileName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refresh(currentUser?: UserProfile | null) {
    const nextUser = currentUser ?? (await getCurrentUser());
    setUser(nextUser);
    setProfileName(nextUser?.name ?? "");
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
        <h2>表示できません</h2>
      </section>
    );
  }

  const canDeleteList = Boolean(user && snapshot.owner.id === user.id);
  const isGuestUser = user?.email.endsWith("@shareshopi.local") ?? false;

  return (
    <div className="page-grid">
      <section className="panel">
        <p className="eyebrow">List Settings</p>
        <h2>{snapshot.list.name}</h2>
      </section>

      <form
        className="panel form-panel"
        action={() => {
          startTransition(async () => {
            try {
              if (!user) {
                throw new Error("ログインが必要です。");
              }
              const nextUser = await updateUserProfile(user, { name: profileName });
              await refresh(nextUser);
              setMessage("ユーザー設定を更新しました。");
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "ユーザー設定の更新に失敗しました。");
            }
          });
        }}
      >
        <div className="compact-heading">
          <p className="eyebrow">User</p>
          <h2>ユーザー設定</h2>
        </div>
        <label>
          表示名
          <input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="表示名" />
        </label>
        <button type="submit" className="primary-button" disabled={isPending}>
          {isPending ? "保存中..." : "ユーザー設定を保存"}
        </button>
      </form>

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
          <h2>通知</h2>
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
              if (!user || isGuestUser) {
                throw new Error("共有するにはGoogleログインが必要です。");
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
          <h2>メンバー</h2>
        </div>
        {isGuestUser ? (
          <div className="demo-box">
            <strong>ログインが必要です</strong>
            <p>ひとり利用のリストはこの端末だけで使えます。ユーザー間で共有する場合は、Googleでログインしてください。</p>
            <Link href="/login" className="primary-button compact-button">Googleでログイン</Link>
          </div>
        ) : (
          <>
            <label>
              登録済みユーザーのメールアドレス
              <input type="email" value={shareEmail} onChange={(event) => setShareEmail(event.target.value)} placeholder="takumi@example.com" />
            </label>
            <button type="submit" className="primary-button" disabled={isPending}>共有メンバーに追加</button>
          </>
        )}
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

      {canDeleteList ? (
        <section className="panel form-panel danger-panel">
          <div className="compact-heading">
            <p className="eyebrow">Danger</p>
            <h2>リスト削除</h2>
          </div>
          <button
            type="button"
            className="ghost-button danger"
            disabled={isPending}
            onClick={() => {
              if (!user) {
                return;
              }
              const confirmed = window.confirm(`「${snapshot.list.name}」を削除します。商品もすべて消えます。`);
              if (!confirmed) {
                return;
              }
              startTransition(async () => {
                try {
                  await removeList(listId, user);
                  const remainingLists = await listAccessibleLists(user.id);
                  router.replace(remainingLists[0] ? `/lists/${remainingLists[0].id}` : "/");
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "リスト削除に失敗しました。");
                }
              });
            }}
          >
            {isPending ? "削除中..." : "リストを削除"}
          </button>
        </section>
      ) : null}
    </div>
  );
}
