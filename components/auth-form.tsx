"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signInLocal, signUpLocal } from "@/lib/local-store";

type Props = {
  mode: "login" | "signup";
};

export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="auth-layout">
      <section className="panel hero-panel">
        <p className="eyebrow">{mode === "login" ? "Welcome Back" : "Free Shared App"}</p>
        <h2>{mode === "login" ? "同じ買い物リストにすぐ戻れるログイン" : "複数人で使える共有リストを無料で開始"}</h2>
        <p className="lead-copy">
          商品ごとの期限、共有メンバー、公開リンク、毎日のまとめリマインドまでこの1つで管理できます。
        </p>
        <div className="mini-metrics">
          <div><strong>共有</strong><span>登録済みユーザー指定</span></div>
          <div><strong>公開</strong><span>URL閲覧のみ</span></div>
          <div><strong>通知</strong><span>毎日1回のまとめメール想定</span></div>
        </div>
      </section>

      <form
        className="panel auth-card"
        action={(formData) => {
          startTransition(async () => {
            try {
              setMessage(null);
              if (mode === "signup") {
                await signUpLocal({
                  name: String(formData.get("name") ?? ""),
                  email: String(formData.get("email") ?? ""),
                  password: String(formData.get("password") ?? ""),
                });
              } else {
                await signInLocal({
                  email: String(formData.get("email") ?? ""),
                  password: String(formData.get("password") ?? ""),
                });
              }
              router.push("/");
              router.refresh();
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "認証に失敗しました。");
            }
          });
        }}
      >
        <div className="compact-heading">
          <p className="eyebrow">{mode === "login" ? "Login" : "Signup"}</p>
          <h2>{mode === "login" ? "ログイン" : "新規登録"}</h2>
        </div>
        {mode === "signup" ? (
          <label>
            表示名
            <input name="name" required maxLength={40} placeholder="たとえば 美香" />
          </label>
        ) : null}
        <label>
          メールアドレス
          <input name="email" type="email" required placeholder="you@example.com" />
        </label>
        <label>
          パスワード
          <input name="password" type="password" required minLength={8} placeholder="8文字以上" />
        </label>
        {message ? <p className="notice-inline">{message}</p> : null}
        <button type="submit" className="primary-button" disabled={isPending}>
          {isPending ? "処理中..." : mode === "login" ? "ログインする" : "無料で始める"}
        </button>
        <p className="compact-copy">
          {mode === "login" ? "アカウントがまだない場合は " : "すでに登録済みなら "}
          <Link href={mode === "login" ? "/signup" : "/login"} className="text-link">
            {mode === "login" ? "新規登録へ" : "ログインへ"}
          </Link>
        </p>
        <div className="demo-box">
          <strong>デモ用ログイン</strong>
          <p>mika@example.com / demo1234</p>
          <p>takumi@example.com / demo1234</p>
        </div>
      </form>
    </div>
  );
}
