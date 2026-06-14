# Cloudflare 移行手順

ShareShopi を Vercel から Cloudflare へ移すための棚卸しと作業手順です。Next.js App Router を使っているため、移行先は Cloudflare Pages の静的ホスティングではなく、Cloudflare Workers + OpenNext を前提にします。

## 現在の棚卸し

### 本番URL

- 現在の本番URL: `https://shareshopi.vercel.app`
- ローカル確認URL: `http://localhost:3001` / `http://127.0.0.1:3001`
- Cloudflare移行後のURL: 未確定。Workersの `*.workers.dev` で検証後、独自ドメインを割り当てる。

### 環境変数

`.env.example` と `.env.local` のキーはそろっています。値はGitHub、README、公開ページに書かないでください。

| 変数 | 用途 | Cloudflareでの扱い |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL | 通常の環境変数 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ブラウザ用Supabase anon key | 通常の環境変数 |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバー側の管理操作 | Secret |
| `RESEND_API_KEY` | 問い合わせ・リマインドメール送信 | Secret |
| `REMINDER_FROM_EMAIL` | メール送信元 | Secretまたは通常の環境変数 |
| `CRON_SECRET` | リマインドAPIの保護 | Secret |

### Supabase URL設定

Supabase Dashboard の `Authentication > URL Configuration` で確認します。

- Site URL: 現在は `https://shareshopi.vercel.app` を想定。
- Redirect URLs: 少なくとも以下を登録する。
- `http://localhost:3001/auth/callback`
- `http://127.0.0.1:3001/auth/callback`
- `https://shareshopi.vercel.app/auth/callback`
- Cloudflare検証URL確定後: `https://<cloudflare-preview-or-domain>/auth/callback`
- Cloudflare本番URL確定後: `https://<production-domain>/auth/callback`

### Google OAuth設定

Google Cloud Console の OAuth クライアントで確認します。

- Authorized JavaScript origins:
- `http://localhost:3001`
- `http://127.0.0.1:3001`
- `https://shareshopi.vercel.app`
- Cloudflare検証URL確定後: `https://<cloudflare-preview-or-domain>`
- Cloudflare本番URL確定後: `https://<production-domain>`

Authorized redirect URIs は Supabase の Google callback URL を登録します。

- `https://oguntadofgerjwfeqxok.supabase.co/auth/v1/callback`

Google OAuth のアプリ公開設定も確認します。

- Audience は外部ユーザーに使わせる場合 `External`。
- 限定テスト中は `Testing` + テストユーザー登録でよい。
- 公開対象を広げる場合は `In production` にする。
- 利用するスコープは `openid` / `email` / `profile` 相当に限定する。

### Vercel依存の確認

現時点のVercel依存は `vercel.json` の Cron 設定のみです。

```json
{
  "crons": [
    {
      "path": "/api/reminders/digest",
      "schedule": "0 8 * * *"
    }
  ]
}
```

アプリコード内で `VERCEL_*` 環境変数や Vercel API に依存している箇所はありません。Cloudflare移行時は、このCronを Cloudflare Workers Cron Triggers に置き換えます。

## 移行方針

- Next.js は Cloudflare Workers 上で OpenNext アダプターを使って動かす。
- Supabase Auth / DB は継続利用する。
- Resend は問い合わせ・リマインドメールが必要な場合のみ継続利用する。
- Vercel Cron は Cloudflare Cron Triggers へ移す。
- まず Cloudflare Preview で動作確認し、問題がなければ DNS を切り替える。
- 移行完了まで `https://shareshopi.vercel.app` は残しておき、切り戻しできる状態にする。

## 事前チェック

移行作業前に以下を通します。

```bash
npm test
npm run build
npm run test:e2e
```

追加でCloudflareビルド確認を行う場合は以下を実行します。

```bash
npm run cf:build
npm run cf:preview
```

## 実装済みのCloudflare準備

`package.json` にはCloudflare用スクリプトを追加済みです。

```json
{
  "scripts": {
    "cf:build": "opennextjs-cloudflare build",
    "cf:preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
    "cf:deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
    "cf:typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"
  }
}
```

導入済みパッケージ:

- `@opennextjs/cloudflare`
- `wrangler`

## 移行作業

### 1. Cloudflare用設定ファイルを作成する

`wrangler.jsonc` を作成します。

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "shareshopi",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-05-16",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "triggers": {
    "crons": ["0 8 * * *"]
  }
}
```

`open-next.config.ts` を作成します。

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
```

### 2. Cloudflareに環境変数を登録する

公開値は通常の環境変数として登録します。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Cloudflare Dashboard の `Workers & Pages > 対象Worker > Settings > Variables and Secrets` から登録します。
`NEXT_PUBLIC_*` はブラウザにも露出する前提の値ですが、GitHubには値を書かないでください。

Secretは以下を登録します。

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put RESEND_API_KEY
wrangler secret put REMINDER_FROM_EMAIL
wrangler secret put CRON_SECRET
```

### 3. ローカルでCloudflare Previewを確認する

```bash
npm run cf:preview
```

確認項目:

- ゲスト利用できる。
- Googleログイン導線が動く。
- メールログイン導線が動く。
- リスト作成・商品追加・チェック削除ができる。
- 設定画面が開ける。
- 招待リンク・QR共有が表示できる。
- 公開リンクが閲覧専用で開ける。
- 問い合わせフォームが送信できる。

### 4. SupabaseとGoogle OAuthへCloudflare URLを追加する

Cloudflare Preview URLまたは独自ドメインが決まったら、SupabaseとGoogle OAuthの許可URLへ追加します。

Supabase:

- `Authentication > URL Configuration > Redirect URLs`
- `https://<cloudflare-url>/auth/callback`

Google Cloud:

- Authorized JavaScript origins: `https://<cloudflare-url>`
- Authorized redirect URIs: `https://oguntadofgerjwfeqxok.supabase.co/auth/v1/callback`

### 5. Cloudflare Cron Triggerへ移行する

Vercel Cron の代替として、Cloudflare Workers Cron Triggers で `GET /api/reminders/digest` と `GET /api/heartbeat` 相当を実行します。

注意点:

- 現在のAPIはHTTPリクエスト前提です。
- Workers Cronから同じ処理を呼び出すため、必要に応じてリマインド送信処理と heartbeat 処理を共通関数へ切り出します。
- `CRON_SECRET` による保護はHTTP実行時に引き続き使います。

### 6. Cloudflareへデプロイする

```bash
npm run cf:deploy
```

### 7. DNSを切り替える

- 独自ドメインをCloudflare Workersに紐付ける。
- Supabase Redirect URLs と Google OAuth origins に独自ドメインを追加する。
- 本番確認完了後、ユーザー案内URLをCloudflare側へ切り替える。
- Vercel側は一定期間残し、問題がなければ停止する。

## 移行後の受け入れ条件

- `npm test` が通る。
- `npm run build` が通る。
- `npm run test:e2e` が通る。
- Cloudflare Previewで主要導線が動く。
- Googleログイン後に通常画面へ戻れる。
- メールログイン後に通常画面へ戻れる。
- ゲスト利用がログイン不要で使える。
- 共有リストでメンバー追加・商品追加・購入済み化ができる。
- 問い合わせフォームが管理者へ届く。
- リマインドが二重送信されない。

## 注意点

- Workers Freeプランにはリクエスト数、CPU時間、Cron、ビルド/実行まわりの制約があります。
- 画像処理、重いSSR、大量メール送信は無料運用と相性が悪いため避けます。
- Cloudflare WorkersとNode.jsでは動作差が出ることがあります。
- 移行前後でOAuth許可URLの不足が最も起きやすいので、URL設定は必ず本番前に確認します。
- Secretの値はGitHub、README、問い合わせフォーム、スクリーンショットに残さないでください。

## 参考

- [Cloudflare Workers Next.js guide](https://developers.cloudflare.com/workers/frameworks/framework-guides/nextjs/)
- [OpenNext Cloudflare docs](https://opennext.js.org/cloudflare)
- [Cloudflare environment variables](https://developers.cloudflare.com/workers/configuration/environment-variables/)
- [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
