export default function PrivacyPage() {
  return (
    <div className="page-grid legal-page">
      <section className="panel legal-panel">
        <p className="eyebrow">Privacy</p>
        <h2>プライバシーポリシー</h2>
        <p>
          ShareShopi は限定ベータ版の共有買い物リストアプリです。ログイン、共有、リマインドに必要な最小限の情報だけを扱います。
        </p>

        <h3>取得する情報</h3>
        <p>Googleログインまたはメールログインで取得するメールアドレス、表示名、ユーザーIDを保存します。</p>
        <p>買い物リスト名、商品名、数量、リマインド日、共有メンバー情報を保存します。</p>

        <h3>利用目的</h3>
        <p>リストの表示、共同編集、共有メンバーの判定、購入済み管理、リマインド通知の送信に利用します。</p>

        <h3>第三者サービス</h3>
        <p>認証とデータ保存に Supabase、ホスティングに Vercel、メール送信に Resend を利用します。</p>

        <h3>問い合わせ</h3>
        <p>削除依頼や問い合わせは、アプリ管理者のサポートメールまで連絡してください。</p>
      </section>
    </div>
  );
}
