# ShareShopi 限定ベータ公開チェックリスト

今月中の公開は、無料運用優先の限定ベータとして扱います。商用利用は正式版または移行判断後にします。

## P0

- [ ] Google Cloud の OAuth アプリが `External` になっている。
- [ ] 必要に応じて Google Cloud の OAuth アプリを `In production` にする。
- [ ] Google OAuth の Authorized JavaScript origins に `https://shareshopi.vercel.app` が入っている。
- [ ] Google OAuth の Authorized redirect URIs に Supabase の callback URL が入っている。
- [ ] Supabase Auth の Google Provider が有効で、Client ID / Client Secret が保存されている。
- [ ] Supabase Auth の Site URL が `https://shareshopi.vercel.app` になっている。
- [ ] Supabase Auth の Redirect URLs に `https://shareshopi.vercel.app/**` とローカル確認用URLが入っている。
- [ ] Vercel の本番環境変数に Supabase / Resend / Cron の値が入っている。
- [ ] 2アカウントで共有リストの作成、メンバー追加、共同編集、非所有者の削除不可を確認する。
- [ ] `npm test`、`npm run test:e2e`、`npm run build` が通る。

## P1

- [ ] `/terms`、`/privacy`、`/contact` を公開前に確認する。
- [ ] Google OAuth のブランド設定にサポートメールと必要URLを反映する。
- [ ] `/api/reminders/digest?dryRun=1` でリマインド対象の preview を確認する。
- [ ] Resend の送信元ドメインまたは送信元メールを確認する。
- [ ] 本番URLでゲスト利用、ログイン導線、共有設定、公開リンク閲覧を確認する。

## P2

- [ ] Vercel、Supabase、Resend の無料枠利用量を週1回確認する。
- [ ] ベータユーザーからの不具合報告先を案内する。
- [ ] 商用化前に Cloudflare 移行または有料ホスティングを再検討する。
