import type { Metadata } from "next";
import { AdSlot } from "@/components/ad-slot";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description: "ShareShopiで扱うログイン情報、買い物リスト、共有メンバー、リマインド情報の取り扱いを説明します。",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <div className="page-grid legal-page">
      <section className="panel legal-panel">
        <p className="eyebrow">Privacy</p>
        <h2>プライバシーポリシー</h2>
        <p>ShareShopi は、ログイン、共有、リマインドに必要な最小限の情報だけを扱います。</p>

        <h3>取得する情報</h3>
        <p>Googleログインまたはメールログインで取得するメールアドレス、表示名、ユーザーIDを保存します。</p>
        <p>買い物リスト名、商品名、数量、リマインド日、共有メンバー情報を保存します。</p>

        <h3>利用目的</h3>
        <p>リストの表示、共同編集、共有メンバーの判定、購入済み管理、リマインド通知の送信に利用します。</p>

        <h3>広告とCookie</h3>
        <p>
          公開ページではGoogle AdSenseによる広告を表示する場合があります。広告配信事業者はCookieなどを利用し、
          閲覧情報に基づいて広告を配信することがあります。
        </p>
        <p>対象地域の同意設定は、Google AdSenseの「プライバシーとメッセージ」で管理します。</p>
      </section>
      <AdSlot placement="legal" label="プライバシーページ広告" />
    </div>
  );
}
