# みんなの買い物リスト

無料運用前提の共有買い物リストアプリです。複数人で同じリストを編集でき、誰が追加した商品か、今日が期限か、期限切れかを色とバッジで見分けやすくしています。

## アプリ概要

このアプリは、家族や同居人、パートナーなど複数人で同じ買い物リストを使うことを想定したシンプルな共有アプリです。商品ごとに「誰が追加したか」「いつまでに買いたいか」「もう購入済みか」をすぐ確認でき、共有メンバーによる共同編集と、URL を知っている人向けの閲覧専用公開リンクの両方に対応しています。

また、完全無料に近い構成で始めやすいように、`Vercel Hobby + Supabase Free + Resend Free` を前提に設計しています。見た目は、状態の色分け、大きめのステータス表示、追加者の名前バッジを中心にしていて、スマホでも迷わず使えることを重視しています。

## 主な機能

- メール+パスワード形式のローカル認証デモ
- 同じリストの共有
- 公開リンクによる閲覧専用ページ
- 商品ごとの日付・時刻・リマインド設定
- 毎日のまとめリマインド用 API ルート
- Supabase/Resend に接続しやすいスキーマと環境変数ひな形

## セットアップ

```bash
npm install
npm run dev
```

`/login` で以下のデモアカウントを使えます。

- `mika@example.com / demo1234`
- `takumi@example.com / demo1234`

## 環境変数

`.env.example` を `.env.local` にコピーし、必要に応じて設定してください。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `REMINDER_FROM_EMAIL`
- `CRON_SECRET`

## 無料運用の想定

- フロント: Vercel Hobby
- DB/Auth: Supabase Free
- メール: Resend Free

`vercel.json` には1日1回の cron 設定を入れています。現状の実装では `POST /api/reminders/digest` にリマインド対象の digest を渡すと、Resend が設定済みなら送信し、未設定なら preview を返します。
