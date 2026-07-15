# ShareShopi 公開チェックリスト

公開前に、現行の Cloudflare Workers + OpenNext / Cloudflare D1 / Firebase Auth 構成で確認する項目です。

## P0

- [ ] Cloudflare Worker `app` が `https://app.shareshopi.workers.dev` で開ける。
- [ ] Cloudflare D1 の本番DBへ最新マイグレーションが適用されている。
- [ ] Cloudflare Variables に公開可能な `NEXT_PUBLIC_FIREBASE_*` が設定されている。
- [ ] Cloudflare Secrets に `RESEND_API_KEY` と `CRON_SECRET` が設定されている。
- [ ] `REMINDER_FROM_EMAIL` がCloudflare側に設定されている。
- [ ] Firebase Auth で Googleログインとメール/パスワードログインが有効になっている。
- [ ] Firebase Auth の Authorized domains に `localhost`、`127.0.0.1`、`app.shareshopi.workers.dev` が入っている。
- [ ] メール未認証ユーザーが更新系APIを利用できない。
- [ ] 2アカウントで共有リストの作成、メンバー追加、共同編集、非所有者の削除不可を確認する。
- [ ] 公開リンクと招待リンクが安全なトークンで発行され、再発行時に旧リンクが失効する。
- [ ] `npm test`、`npx tsc --noEmit`、`npm run build`、`npm run cf:build` が通る。
- [ ] `npm run test:e2e:smoke` がローカルで通る。
- [ ] `npm run test:e2e:prod` が本番URLで通る。
- [ ] Cloudflare binding型を `npm run cf:typegen` で再生成済み。
- [ ] GitHub Secrets に `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` が設定されている。
- [ ] GitHub Variables または Secrets に `NEXT_PUBLIC_FIREBASE_*` が設定されている。

## P1

- [ ] `/terms`、`/privacy`、`/contact` を公開前に確認する。
- [ ] Firebase Auth のアプリ名、サポートメール、承認済みドメインを確認する。
- [ ] `/api/reminders/digest?dryRun=1` でリマインド対象の preview を確認する。
- [ ] Cloudflare Cron Triggers の実行履歴を確認する。
- [ ] Resend の送信元メール、送信成功、失敗、バウンスを確認する。
- [ ] 本番URLでゲスト利用、ログイン導線、共有設定、公開リンク閲覧を確認する。

## P2

- [ ] Cloudflare、D1、Firebase、Resend の無料枠利用量を週1回確認する。
- [ ] D1バックアップを `npx wrangler d1 export shareshopi-prod --remote --output ...` で取得できる。
- [ ] ユーザーからの不具合報告先を案内する。
- [ ] 独自ドメインとメール送信元ドメイン認証の要否を判断する。
- [ ] 商用化前に課金方式、法務ページ、サポート運用を再確認する。
