import type { Metadata } from "next";
import { AdSlot } from "@/components/ad-slot";

export const metadata: Metadata = {
  title: "利用規約",
  description: "ShareShopiの利用範囲、禁止事項、免責、規約変更について説明します。",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <div className="page-grid legal-page">
      <section className="panel legal-panel">
        <p className="eyebrow">Terms</p>
        <h2>利用規約</h2>
        <p>ShareShopi の機能や提供条件は、サービス改善のため変更される場合があります。</p>

        <h3>利用範囲</h3>
        <p>個人、家族、知人との買い物リスト共有を目的として利用してください。商用利用は正式版公開後に別途案内します。</p>

        <h3>禁止事項</h3>
        <p>不正アクセス、他人になりすました利用、過度な自動アクセス、第三者の権利を侵害する内容の登録は禁止します。</p>

        <h3>免責</h3>
        <p>データ損失、通知遅延、サービス停止が起きる可能性があります。重要な情報の唯一の保管先にはしないでください。</p>

        <h3>変更</h3>
        <p>規約を変更した場合は、アプリ内またはREADME等で知らせます。</p>
      </section>
      <AdSlot placement="legal" label="利用規約ページ広告" />
    </div>
  );
}
