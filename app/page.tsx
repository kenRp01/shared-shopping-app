import type { Metadata } from "next";
import Link from "next/link";
import { AdSlot } from "@/components/ad-slot";

export const metadata: Metadata = {
  title: "共有できる買い物リストアプリ",
  description:
    "ShareShopiは、個人利用も家族・友人との共有もできる買い物リストアプリです。リスト共有、購入済み管理、リマインド、公開リンクに対応しています。",
  alternates: {
    canonical: "/",
  },
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.shareshopi.workers.dev";

const homeFaqs = [
  {
    question: "無料で使える？",
    answer: "個人利用はログインなし。共有も基本無料で使えます。",
  },
  {
    question: "共有はかんたん？",
    answer: "招待リンクやQRで、家族や友人と同じリストを使えます。",
  },
  {
    question: "スマホで使いやすい？",
    answer: "横スクロールでリスト切替。商品はリスト内からすぐ追加できます。",
  },
];

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ShareShopi",
    url: siteUrl,
    inLanguage: "ja",
    description: "買い物リストをみんなでシェアできる、スマホ向け共有買い物リストアプリです。",
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ShareShopi",
    url: siteUrl,
    logo: `${siteUrl}/shareshopi-icon.png`,
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ShareShopi",
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    url: siteUrl,
    inLanguage: "ja",
    isAccessibleForFree: true,
    description: "家族や友人と買い物リストを共有できるWebアプリ。個人利用はログイン不要で始められます。",
    featureList: ["共有買い物リスト", "購入済みチェック", "リマインド", "招待リンク", "QR共有"],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "JPY",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: homeFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  },
];

export default function HomePage() {
  return (
    <div className="seo-landing">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="seo-hero panel">
        <div className="seo-hero-copy">
          <p className="eyebrow">ShareShopi</p>
          <h1>買い物リストをみんなでシェア</h1>
          <p>共有、チェック、リマインドを1画面で。ひとりでも、家族とも。</p>
          <div className="seo-actions">
            <Link className="primary-button" href={{ pathname: "/app" }}>
              すぐ使う
            </Link>
            <Link className="ghost-button" href="/login">
              ログイン
            </Link>
          </div>
          <div className="seo-quick-points" aria-label="ShareShopiの特徴">
            <span>ログインなしOK</span>
            <span>共有できる</span>
            <span>買い忘れ防止</span>
          </div>
        </div>

        <div className="seo-hero-preview" aria-label="ShareShopiの画面イメージ">
          <div className="seo-phone-card">
            <div className="seo-phone-head">
              <span className="active">共有</span>
              <span>マイリスト</span>
            </div>
            <div className="seo-preview-list">
              <div className="seo-preview-item">
                <span className="seo-preview-check" />
                <div>
                  <strong>牛乳</strong>
                  <small>今日</small>
                </div>
                <span>1</span>
              </div>
              <div className="seo-preview-item">
                <span className="seo-preview-check seo-preview-check-done" />
                <div>
                  <strong>たまご</strong>
                  <small>購入済み</small>
                </div>
                <span>6</span>
              </div>
              <div className="seo-preview-item accent">
                <span className="seo-preview-check" />
                <div>
                  <strong>洗剤</strong>
                  <small>明日</small>
                </div>
                <span>1</span>
              </div>
            </div>
            <div className="seo-preview-add">+ Add item</div>
          </div>
        </div>
      </section>

      <section className="seo-feature-grid" aria-label="ShareShopiの主な機能">
        <article className="seo-feature-card">
          <h2>一緒に編集</h2>
          <p>同じリストを共有。</p>
        </article>
        <article className="seo-feature-card">
          <h2>タップで完了</h2>
          <p>購入済みがすぐ分かる。</p>
        </article>
        <article className="seo-feature-card">
          <h2>買い忘れ防止</h2>
          <p>日付でリマインド。</p>
        </article>
        <article className="seo-feature-card">
          <h2>すぐ開始</h2>
          <p>ひとり利用はログイン不要。</p>
        </article>
      </section>

      <section className="seo-faq-strip panel" aria-labelledby="home-faq-title">
        <div className="seo-faq-strip-head">
          <p className="eyebrow">FAQ</p>
          <h2 id="home-faq-title">よくある質問</h2>
        </div>
        <div className="seo-faq-list">
          {homeFaqs.map((faq) => (
            <article className="seo-faq-item" key={faq.question}>
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <AdSlot slot={process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_HOME} label="トップページ広告" />
    </div>
  );
}
