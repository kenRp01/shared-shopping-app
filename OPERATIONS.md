# ShareShopi 運用メモ

## 現在の構成

- Frontend/API: Cloudflare Workers + OpenNext
- DB: Cloudflare D1
- Auth: Firebase Auth
- Mail: Resend
- Scheduler: Cloudflare Cron Triggers

## 週次確認

- Cloudflare: Workerエラー、Cron Events、D1使用量。
- Firebase: Authユーザー数、ログイン失敗。
- Resend: 送信成功、失敗、バウンス、無料枠残量。
- アプリ: Google/メールログイン、共有追加、商品追加、購入済み化、公開リンク閲覧。

## リマインドCron

- `wrangler.jsonc`の`0 23 * * *`で毎日23:00 UTC（08:00 JST）に実行する。
- Custom Workerの`scheduled()`が内部の`GET /api/reminders/digest`を呼び出す。
- `Authorization: Bearer <CRON_SECRET>`で保護する。
- 同じ`list_id`と`delivery_date`への重複送信は`reminder_delivery_logs`で防ぐ。
- 実行履歴は`Workers & Pages > shareshopi > Settings > Triggers > Cron Events`で確認する。

ローカル確認:

```bash
npm run cf:build
npx wrangler dev --test-scheduled
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=0+23+*+*+*&format=json"
```

## 招待・公開リンク

- トークンは256-bitの暗号学的乱数で生成し、D1にはSHA-256ハッシュだけを保存する。
- 招待リンクは7日間有効で、再発行すると以前の招待リンクを失効させる。
- 公開リンクの再発行でも以前の公開URLを失効させる。
- `0004_remove_plaintext_share_tokens.sql`適用時、従来の短い公開・招待リンクは安全のため無効になる。
- 本番反映前に`npx wrangler d1 migrations apply shareshopi-prod --remote`を実行し、設定画面からリンクを再発行する。

## メール認証

- GoogleログインはFirebaseが検証済みメールを返すため、そのまま利用できる。
- メール登録は確認メール内のリンクを開くまでログイン・API利用を許可しない。
- APIはFirebase ID Tokenの`email_verified`を検証し、未認証の場合は`403`を返す。
- 登録直後と未認証ログイン時はFirebase・IndexedDB双方のセッションを削除する。

## API不正利用対策

- Cloudflare Rate Limiting Bindingで、API全体を1利用者あたり120回/分に制限する。
- 問い合わせ、招待作成・承認、メンバー追加、共有URL再発行は15回/分に制限する。
- 認証済み利用者はBearer tokenのSHA-256ハッシュ、未認証利用者は接続元IPを制限キーに使う。生のtokenは保存・ログ出力しない。
- ブラウザからの更新系APIは同一Originだけを許可し、リクエスト本文は32KBまでに制限する。
- 拒否したリクエストはWorkerログへmethod、path、statusだけを記録する。
- Cloudflareの制限はPoP単位かつ結果整合のため、分散攻撃への完全な防御ではない。公開後はログを確認し、必要ならTurnstileを問い合わせフォームへ追加する。

## デプロイ

- ドキュメントだけの変更ではデプロイしない。
- コード変更は`npm test`、`npm run test:e2e`、`npm run build`、`npm run cf:build`を確認する。
- 秘密情報は`.env.local`とCloudflare Secretsだけに保存し、GitHubへpushしない。
