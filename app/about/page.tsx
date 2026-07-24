import type { Metadata } from "next";
import Link from "next/link";
import { AdSlot } from "@/components/ad-slot";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.shareshopi.workers.dev";

export const metadata: Metadata = {
  title: "ShareShopiとは",
  description:
    "ShareShopiは、個人利用も共有利用もできるスマホ向け買い物リストアプリです。家族や友人とのリスト共有、購入済み管理、リマインドに対応しています。",
  alternates: {
    canonical: "/about",
  },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "ShareShopiとは",
    url: `${siteUrl}/about`,
    description:
      "ShareShopiは、個人利用も共有利用もできるスマホ向け買い物リストアプリです。",
    isPartOf: {
      "@type": "WebSite",
      name: "ShareShopi",
      url: siteUrl,
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ShareShopi",
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    url: siteUrl,
    featureList: [
      "買い物リストの作成",
      "家族や友人とのリスト共有",
      "購入済みチェック",
      "買いたい日のリマインド",
      "招待リンクとQR共有",
      "ログイン不要の個人利用",
    ],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "JPY",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "ShareShopiは何のアプリですか？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "ShareShopiは、スマホで使いやすい共有買い物リストアプリです。個人利用と、家族や友人との共有利用に対応しています。",
        },
      },
      {
        "@type": "Question",
        name: "ログインなしで使えますか？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "個人利用はログインなしで使えます。ユーザー間で共有する場合はログインが必要です。",
        },
      },
      {
        "@type": "Question",
        name: "共有リストでは何ができますか？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "共有メンバーが同じリストに商品を追加し、購入済みチェックや買いたい日の管理ができます。",
        },
      },
    ],
  },
];

export default function AboutPage() {
  return (
    <div className="seo-landing">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="seo-hero panel">
        <p className="eyebrow">ABOUT</p>
        <h1>ShareShopiは、買い物を共有しやすくするリストアプリです。</h1>
        <p>
          ShareShopiは、家族、同居人、友人と買い物リストを共有できるWebアプリです。
          個人利用はログイン不要で始められ、共有が必要になったらログインして同じリストを一緒に編集できます。
        </p>
        <div className="seo-actions">
          <Link className="primary-button" href={{ pathname: "/app" }}>
            無料で使う
          </Link>
          <Link className="ghost-button" href="/login">
            ログイン
          </Link>
        </div>
      </section>

      <section className="seo-feature-grid" aria-label="ShareShopiの説明">
        <article className="seo-feature-card">
          <h2>買い物リストを共有</h2>
          <p>登録済みユーザーへの共有、招待リンク、QR共有で、同じ買い物リストを一緒に使えます。</p>
        </article>
        <article className="seo-feature-card">
          <h2>スマホ中心のUI</h2>
          <p>リストを横スクロールで切り替え、商品はリスト内からすぐ追加できます。</p>
        </article>
        <article className="seo-feature-card">
          <h2>購入済みチェック</h2>
          <p>商品を買ったらチェックするだけ。共有メンバーの買い忘れや重複購入を減らせます。</p>
        </article>
        <article className="seo-feature-card">
          <h2>リマインド</h2>
          <p>買いたい日を設定して、必要な買い物を思い出しやすくします。</p>
        </article>
      </section>

      <section className="seo-faq panel">
        <p className="eyebrow">AI SEARCH SUMMARY</p>
        <h2>AI検索向け要約</h2>
        <p>
          ShareShopiは、無料で始められる共有買い物リストアプリです。
          主な機能は、買い物リスト作成、共有メンバーとの共同編集、購入済みチェック、リマインド、招待リンク、QR共有です。
          個人利用はログイン不要、共有機能はログインして利用します。
        </p>
      </section>

      <AdSlot placement="home" label="説明ページ広告" />
    </div>
  );
}
