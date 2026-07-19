# ShareShopi

Cloudflare Workers上で動く、モバイル中心の共有買い物リストです。個人利用はログイン不要、共有利用はFirebase Authで認証し、データはCloudflare D1へ保存します。

## 主な機能

- Firebase AuthによるGoogleログイン、メールアドレスログイン
- IndexedDBを使ったログイン不要の個人利用
- D1に保存する共有リスト、メンバー、商品、招待リンク
- 閲覧専用公開リンクとQRコード
- 商品の期限、追加者、購入済み管理
- Cloudflare Cron + Resendによる日次リマインド

## 開発

Node.js 20以上を使用します。

```bash
npm install
npm run dev
```

Cloudflare環境で確認する場合:

```bash
npm run cf:preview
```

本番URLは `https://app.shareshopi.workers.dev` です。

## 環境変数

公開可能なFirebase Web設定:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Worker Secret:

- `RESEND_API_KEY`
- `CRON_SECRET`

通常のWorker変数:

- `REMINDER_FROM_EMAIL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT`
- `NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_HOME`
- `NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_LOGIN`
- `NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_LEGAL`
- `GOOGLE_ADSENSE_PUBLISHER_ID`

秘密値は`.env.local`、`.dev.vars`、Cloudflare Dashboardまたは`wrangler secret put`で管理し、Gitへコミットしません。

SEOと広告設定の詳細は`docs/seo-monetization.md`を参照してください。

## Firebase設定

1. Firebase ConsoleでWebアプリを作成する。
2. AuthenticationでGoogleとメール/パスワードを有効化する。
3. Authenticationの承認済みドメインへローカル、本番Worker、独自ドメインを追加する。
4. Webアプリ設定の4項目を上記`NEXT_PUBLIC_FIREBASE_*`へ設定する。

APIはFirebase ID TokenをGoogle公開鍵で検証し、`uid`とD1の`profiles.firebase_uid`を対応付けます。パスワードはFirebase Authが管理し、D1には保存しません。

## D1

```bash
npx wrangler d1 migrations apply shareshopi-prod --local
npx wrangler d1 migrations apply shareshopi-prod --remote
```

D1 bindingは`wrangler.jsonc`の`DB`です。APIはD1専用で、外部DBへのフォールバックはありません。

## 検証

```bash
npm test
npx tsc --noEmit
npm run build
npm run test:e2e
npm run test:e2e:smoke
npm run test:e2e:prod
npm run cf:build
```

日次リマインドはCloudflare Cronが毎日08:00 JSTに実行します。Cron設定と確認方法は`OPERATIONS.md`を参照してください。

## CI/CD

GitHub ActionsでCIとCloudflareデプロイを分けています。

- `.github/workflows/ci.yml`: `npm test`、`npx tsc --noEmit`、`npm run build`、`npm run test:e2e:smoke`、`npm run cf:build`
- `.github/workflows/deploy.yml`: main pushまたは手動実行で検証後に`npm run cf:deploy`

GitHubの`Settings > Secrets and variables > Actions`に以下を設定します。

Secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

VariablesまたはSecrets:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Worker実行時の秘密値はGitHubではなくCloudflare側に設定します。

- `CRON_SECRET`
- `RESEND_API_KEY`
- `REMINDER_FROM_EMAIL`

本番デプロイはローカル確認後、明示的に実施します。
