"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import QRCode from "qrcode";
import { getCurrentUser, getListSettingsSnapshot, updateListSettings, addListMember, removeList, updateUserProfile, createListInvite } from "@/lib/local-store";
import type { ListInvite, ShoppingListOverview, ShoppingListSnapshot, UserProfile } from "@/lib/types";

type Props = {
  listId: string;
};

type SettingsCache = {
  user: UserProfile;
  snapshot: ShoppingListSnapshot;
  categories: ShoppingListOverview[];
  cachedAt: number;
};

const SETTINGS_CACHE_KEY = "shareshopi:settings-list";
const SETTINGS_CACHE_TTL_MS = 1000 * 60 * 3;

function consumeSettingsCache(listId: string): SettingsCache | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = sessionStorage.getItem(SETTINGS_CACHE_KEY);
  if (!raw) {
    return null;
  }
  sessionStorage.removeItem(SETTINGS_CACHE_KEY);
  try {
    const parsed = JSON.parse(raw) as SettingsCache;
    if (parsed.snapshot?.list.id !== listId || Date.now() - parsed.cachedAt > SETTINGS_CACHE_TTL_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function normalizeDisplayName(name: string) {
  return name === "ひとり利用" ? "個人利用" : name;
}

export function ListSettingsClient({ listId }: Props) {
  const router = useRouter();
  const [initialCache] = useState(() => consumeSettingsCache(listId));
  const [user, setUser] = useState<UserProfile | null>(initialCache?.user ?? null);
  const [snapshot, setSnapshot] = useState<ShoppingListSnapshot | null>(initialCache?.snapshot ?? null);
  const [categories, setCategories] = useState<ShoppingListOverview[]>(initialCache?.categories ?? []);
  const [shareEmail, setShareEmail] = useState("");
  const [invite, setInvite] = useState<ListInvite | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [profileName, setProfileName] = useState(normalizeDisplayName(initialCache?.user.name ?? ""));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refresh(currentUser?: UserProfile | null) {
    const nextUser = currentUser ?? (await getCurrentUser());
    setUser(nextUser);
    setProfileName(normalizeDisplayName(nextUser?.name ?? ""));
    if (nextUser) {
      setSnapshot(await getListSettingsSnapshot(listId, nextUser.id));
    }
  }

  useEffect(() => {
    if (initialCache?.snapshot) {
      return;
    }
    refresh();
  }, [listId]);

  useEffect(() => {
    let active = true;
    if (!invite?.url) {
      setQrDataUrl(null);
      return;
    }

    QRCode.toDataURL(invite.url, {
      margin: 1,
      width: 176,
      color: {
        dark: "#17362b",
        light: "#fffefb",
      },
    }).then((dataUrl) => {
      if (active) {
        setQrDataUrl(dataUrl);
      }
    }).catch(() => {
      if (active) {
        setQrDataUrl(null);
      }
    });

    return () => {
      active = false;
    };
  }, [invite?.url]);

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
          <p className="eyebrow">User Setting</p>
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
        </div>
        <label className="checkbox-row">
          <input name="dailyReminderEnabled" type="checkbox" defaultChecked={snapshot.list.dailyReminderEnabled} />
          毎日リマインドする
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
        </div>
        {isGuestUser ? (
          <div className="demo-box">
            <strong>ログインが必要です</strong>
            <p>個人利用のリストはこの端末だけで使えます。ユーザー間で共有する場合は、Googleでログインしてください。</p>
            <Link href="/login" className="primary-button compact-button">Googleでログイン</Link>
          </div>
        ) : (
          <>
            <div className="invite-card">
              <div>
                <strong>招待リンク</strong>
                <p>リンクかQRで共有できます。</p>
              </div>
              <div className="invite-actions">
                <button
                  type="button"
                  className="ghost-button compact-button"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        if (!user) {
                          throw new Error("ログインが必要です。");
                        }
                        const nextInvite = await createListInvite(listId, user);
                        setInvite(nextInvite);
                        setMessage("招待リンクを作成しました。");
                      } catch (error) {
                        setMessage(error instanceof Error ? error.message : "招待リンクを作成できませんでした。");
                      }
                    });
                  }}
                >
                  リンク作成
                </button>
                {invite?.url ? (
                  <button
                    type="button"
                    className="ghost-button compact-button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(invite.url);
                      setMessage("招待リンクをコピーしました。");
                    }}
                  >
                    コピー
                  </button>
                ) : null}
              </div>
              {invite?.url ? <code className="invite-url">{invite.url}</code> : null}
              {qrDataUrl ? <img className="invite-qr" src={qrDataUrl} alt="共有招待リンクのQRコード" /> : null}
            </div>
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
                <strong>{normalizeDisplayName(member.name)}</strong>
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
            <p className="eyebrow">Delete</p>
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
                  const fallbackList = categories.find((list) => list.id !== listId);
                  router.replace(fallbackList ? `/lists/${fallbackList.id}` : "/");
                  removeList(listId, user).catch((error) => {
                    window.alert(error instanceof Error ? error.message : "リスト削除に失敗しました。");
                  });
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
