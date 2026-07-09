# Cloudflare移行状況

## 最終構成

| 領域 | 採用サービス |
| --- | --- |
| Frontend/API | Cloudflare Workers + OpenNext |
| DB | Cloudflare D1 |
| Auth | Firebase Auth |
| Mail | Resend |
| Scheduler | Cloudflare Cron Triggers |

アプリコードの旧DB/Auth依存は削除済みです。共有データはD1 binding `DB`、認証はFirebase ID Tokenで扱います。

## 実装済み

- `@opennextjs/cloudflare`とWranglerの導入
- D1データベース`shareshopi-prod`とマイグレーション
- 既存プロフィールを維持する`firebase_uid`対応
- 全共有APIのD1化
- APIでのFirebase ID Token検証
- Firebase Google/メールログイン
- 旧callback、heartbeat、DBクライアントの削除

## Cloudflare設定

Firebase Web設定はCloudflare WorkersのVariablesへ登録します。

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `REMINDER_FROM_EMAIL`

秘密値はSecretsへ登録します。

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put CRON_SECRET
```

`NEXT_PUBLIC_*`はビルド時にも必要なため、ローカルでは`.env.local`へ設定してから`npm run cf:build`を実行します。

## Firebase設定

Firebase Consoleの`Authentication > Settings > Authorized domains`へ次を追加します。

- ローカル確認用ホスト
- `app.shareshopi.workers.dev`
- 利用する独自ドメイン

Googleとメール/パスワードのSign-in providerを有効化します。

## D1更新

```bash
npx wrangler d1 migrations apply shareshopi-prod --local
npx wrangler d1 migrations apply shareshopi-prod --remote
```

本番適用前に、適用対象とマイグレーション履歴を確認します。

## 検証とデプロイ

```bash
npm test
npm run build
npm run test:e2e
npm run cf:build
npm run cf:preview
```

動作確認後のみデプロイします。

```bash
npm run cf:deploy
```

## 受け入れ条件

- Google/メールログイン後にD1プロフィールが作成または既存プロフィールへ紐付く。
- 2アカウント間でリスト共有、商品追加、購入済み化が同期される。
- 所有者だけが設定変更、メンバー追加、リスト削除を実行できる。
- 招待リンク、QR、閲覧専用公開リンクが動作する。
- 日次リマインドが重複せず送信される。
- 旧DB/Authの環境変数なしでWorkersが起動する。
