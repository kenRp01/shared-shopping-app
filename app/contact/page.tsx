export default function ContactPage() {
  return (
    <div className="page-grid legal-page">
      <section className="panel legal-panel">
        <p className="eyebrow">Contact</p>
        <h2>問い合わせ</h2>
        <p>ShareShopi 限定ベータに関する不具合、共有の相談、データ削除依頼はサポートメールへ連絡してください。</p>

        <div className="support-card">
          <span>サポートメール</span>
          <strong>限定ベータ招待時に案内した連絡先</strong>
        </div>

        <p className="muted-text">
          GitHubや公開ページに個人情報、APIキー、パスワードを書き込まないでください。
        </p>
      </section>
    </div>
  );
}
