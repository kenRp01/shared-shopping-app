import type { Metadata } from "next";
import { AdSlot } from "@/components/ad-slot";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = {
  title: "問い合わせ",
  description: "ShareShopiへの不具合報告、共有の相談、データ削除依頼を送信できます。",
  alternates: {
    canonical: "/contact",
  },
};

export default function ContactPage() {
  return (
    <div className="page-grid legal-page">
      <section className="panel legal-panel">
        <p className="eyebrow">Contact</p>
        <p>不具合、共有の相談、データ削除依頼はこちらから送信してください。</p>

        <ContactForm />
      </section>
      <AdSlot slot={process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_LEGAL} label="問い合わせページ広告" />
    </div>
  );
}
