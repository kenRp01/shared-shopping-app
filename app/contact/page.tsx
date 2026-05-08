import { ContactForm } from "@/components/contact-form";

export default function ContactPage() {
  return (
    <div className="page-grid legal-page">
      <section className="panel legal-panel">
        <p className="eyebrow">Contact</p>
        <p>不具合、共有の相談、データ削除依頼はこちらから送信してください。</p>

        <ContactForm />
      </section>
    </div>
  );
}
