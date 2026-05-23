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

function friendlyInviteError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("shopping_list_invites") || message.includes("schema cache")) {
    return "招待リンク用のDB設定が未反映です。公開リンクのQR共有を使うか、Supabaseでschema.sqlを適用してください。";
  }
  return message || "招待リンクを作成できませんでした。";
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
  const [publicQrDataUrl, setPublicQrDataUrl] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
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
    setOrigin(window.location.origin);
  }, []);

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

  const publicUrl = snapshot?.list.publicToken ? `${origin}/public/${snapshot.list.publicToken}` : null;

  useEffect(() => {
    let active = true;
    if (!publicUrl) {
      setPublicQrDataUrl(null);
      return;
    }

    QRCode.toDataURL(publicUrl, {
      margin: 1,
      width: 176,
      color: {
        dark: "#17362b",
        light: "#fffefb",
      },
    })
      .then((dataUrl) => {
        if (active) {
          setPublicQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (active) {
          setPublicQrDataUrl(null);
        }
      });

    return () => {
      active = false;
    };
  }, [publicUrl]);

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
    <div className="page-grid settings-shell">
      <section className="settings-appbar" aria-label="設定ヘッダー">
        <Link href={`/lists/${listId}`} className="settings-back-link" aria-label="リストへ戻る">
          <BackIcon />
        </Link>
        <div>
          <h2>Settings</h2>
          <p>{snapshot.list.name}</p>
        </div>
      </section>

      {message ? <p className="settings-notice">{message}</p> : null}

      <section className="settings-section">
        <p className="settings-section-title">LIST SETTINGS</p>
        <a href="#sharing" className="settings-nav-card">
          <span className="settings-nav-icon">
            <ShareIcon />
          </span>
          <span>
            <strong>Sharing</strong>
            <small>Manage collaborators</small>
          </span>
          <ChevronIcon />
        </a>
      </section>

      <form
        className="settings-section"
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
        <p className="settings-section-title">USER SETTING</p>
        <div className="settings-card">
          <label className="settings-field">
            <span>Display Name</span>
            <input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Display Name" />
          </label>
          <button type="submit" className="primary-button settings-save-button" disabled={isPending}>
            {isPending ? "Saving..." : "Save User Settings"}
          </button>
        </div>
      </form>

      <form
        className="settings-section"
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
        <p className="settings-section-title">REMINDER</p>
        <div className="settings-card settings-reminder-card">
          <label className="settings-toggle-row">
            <span>Daily Reminder</span>
            <input name="dailyReminderEnabled" type="checkbox" defaultChecked={snapshot.list.dailyReminderEnabled} />
          </label>
          <label className="settings-time-row">
            <span>Notification Time</span>
            <span className="settings-time-input">
              <ClockIcon />
              <input name="dailyReminderHour" type="time" defaultValue={snapshot.list.dailyReminderHour} />
            </span>
          </label>
        </div>

        <p className="settings-section-title">PUBLICITY</p>
        <div className="settings-card settings-public-card">
          <label className="settings-field">
            <span>Visibility Level</span>
            <select name="visibility" defaultValue={snapshot.list.visibility}>
              <option value="private">Private</option>
              <option value="shared">Shared Members</option>
              <option value="public_link">Public Link</option>
            </select>
          </label>
          <label className="settings-toggle-row">
            <span>Enable Public Link</span>
            <input name="publicEnabled" type="checkbox" defaultChecked={Boolean(snapshot.list.publicToken)} />
          </label>
          {snapshot.list.publicToken ? (
            <div className="settings-public-url">
              <span>Public URL</span>
              <strong>{publicUrl}</strong>
              <Link href={`/public/${snapshot.list.publicToken}`} className="text-link">
                <OpenIcon />
                Open Public Page
              </Link>
              {publicQrDataUrl ? <img className="invite-qr" src={publicQrDataUrl} alt="公開リンクのQRコード" /> : null}
            </div>
          ) : null}
          <button type="submit" className="primary-button settings-save-button" disabled={isPending}>
            {isPending ? "Saving..." : "Save List Settings"}
          </button>
        </div>
      </form>

      <form
        id="sharing"
        className="settings-section"
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
        <p className="settings-section-title">MEMBERS</p>
        <div className="settings-card settings-sharing-card">
          {isGuestUser ? (
            <div className="demo-box settings-login-box">
              <strong>ログインが必要です</strong>
              <p>個人利用のリストはこの端末だけで使えます。ユーザー間で共有する場合は、Googleでログインしてください。</p>
              <Link href="/login" className="primary-button compact-button">Googleでログイン</Link>
            </div>
          ) : (
            <>
              <div className="invite-card settings-invite-card">
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
                          setMessage(friendlyInviteError(error));
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
              <label className="settings-field">
                <span>Member Email</span>
                <input type="email" value={shareEmail} onChange={(event) => setShareEmail(event.target.value)} placeholder="takumi@example.com" />
              </label>
              <button type="submit" className="primary-button settings-save-button" disabled={isPending}>
                共有メンバーに追加
              </button>
            </>
          )}
          <div className="member-list settings-member-list">
            {snapshot.members.map((member) => (
              <div className="member-row settings-member-row" key={member.id}>
                <div>
                  <strong>{normalizeDisplayName(member.name)}</strong>
                  <p>{member.email}</p>
                </div>
                <span className="tag">{member.role === "owner" ? "所有者" : "編集者"}</span>
              </div>
            ))}
          </div>
        </div>
      </form>

      {canDeleteList ? (
        <section className="settings-section">
          <p className="settings-section-title">DELETE</p>
          <div className="settings-card settings-delete-card">
          <button
            type="button"
            className="ghost-button danger settings-delete-button"
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
          </div>
        </section>
      ) : null}
    </div>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.7 10.7 6.6-4.4" />
      <path d="m8.7 13.3 6.6 4.4" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4h6v6" />
      <path d="M10 14 20 4" />
      <path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" />
    </svg>
  );
}
