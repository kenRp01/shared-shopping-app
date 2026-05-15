# Cloudflare 移行手順

ShareShopi を Vercel から Cloudflare へ移す場合の作業メモです。Next.js App Router を使っているため、移行先は Cloudflare Pages の静的ホスティングではなく、Cloudflare Workers + OpenNext を前提にします。

## 方針

- Next.js は Cloudflare Workers 上で OpenNext アダプターを使って動かす。
- Supabase Auth / DB は継続利用する。
- Resend は問い合わせ・リマインドメールが必要な場合のみ継続利用する。
- まず Preview 環境で動作確認し、問題なければ DNS を切り替える。

## 事前確認

- `npm test` と `npm run build` が通ること。
- Supabase の `Authentication > URL Configuration` に Cloudflare の本番URLを追加すること。
- Google OAuth の Authorized JavaScript origins / Redirect URLs に Cloudflare の本番URLを追加すること。
- Vercel 固有の環境変数設定を Cloudflare 側へ移すこと。

## 導入手順

1. OpenNext Cloudflare アダプターを追加する。

```bash
npm install @opennextjs/cloudflare@latest
npm install -D wrangler@latest
```

2. `package.json` に Cloudflare 用スクリプトを追加する。

```json
{
  "scripts": {
    "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
    "deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
    "upload": "opennextjs-cloudflare build && opennextjs-cloudflare upload",
    "cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"
  }
}
```

3. `wrangler.jsonc` を作成する。

```jsonc
{
  "name": "shareshopi",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-05-09",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  }
}
```

4. `open-next.config.ts` を作成する。

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
```

5. Cloudflare に環境変数・Secrets を登録する。

公開してよい値:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Secrets として登録する値:

- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `RESEND_API_KEY`
- `REMINDER_FROM_EMAIL`

6. ローカルで Cloudflare ビルドを確認する。

```bash
npm run preview
```

7. Preview URL で確認する。

- ゲスト利用できる。
- Googleログインできる。
- メールログインできる。
- リスト作成・商品追加・チェック削除ができる。
- 共有設定画面が開ける。
- 招待リンク・公開リンクが正しく開ける。
- 問い合わせフォームが送信できる。

8. OAuth / Supabase 側のURLを本番URLへ追加する。

- Supabase Site URL
- Supabase Redirect URLs
- Google OAuth Authorized JavaScript origins
- Google OAuth Authorized redirect URIs

9. 本番デプロイする。

```bash
npm run deploy
```

10. DNS を切り替える。

- 独自ドメインを Cloudflare Workers へ紐付ける。
- 旧Vercel URLはしばらく残して、問題がなければ案内先を新URLへ寄せる。

## 注意点

- OpenNext Cloudflare は `nodejs_compat` が必要。
- Wrangler は `3.99.0` 以上が必要。
- Workers Free プランはバンドルサイズやCPU時間の制約があるため、画像処理・重いSSR・大量メール送信は避ける。
- Next.js の一部機能は Node.js 環境との差が出る可能性があるため、E2Eで確認する。
- 商用利用時は Cloudflare / Supabase / Resend の無料枠制約を再確認する。

## 参考

- [Cloudflare Workers Next.js guide](https://developers.cloudflare.com/workers/frameworks/framework-guides/nextjs/)
- [OpenNext Cloudflare docs](https://opennext.js.org/cloudflare)
- [Cloudflare Pages bindings](https://developers.cloudflare.com/pages/functions/bindings/)
