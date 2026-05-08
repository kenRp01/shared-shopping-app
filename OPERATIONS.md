# ShareShopi 運用メモ

## 無料枠の前提

- Vercel Hobby は個人・非商用向けとして限定ベータで使います。
- Supabase Free は小規模検証向けです。DBサイズ、MAU、プロジェクト停止条件を定期確認します。
- Resend Free は送信数に制限があります。リマインドメール数が増えたら送信頻度や有料化を見直します。

## 週次確認

- Vercel: デプロイ状態、Cron実行履歴、Functionエラー。
- Supabase: Authユーザー数、DB容量、APIエラー、RLS関連エラー。
- Resend: 送信成功数、送信失敗、バウンス、無料枠残量。
- アプリ: Googleログイン、メールログイン、共有追加、商品追加、チェック削除、公開リンク閲覧。

## リマインド

- Vercel Cron が `GET /api/reminders/digest` を毎日実行します。
- `CRON_SECRET` が設定されている場合、Vercel Cron は `Authorization: Bearer <CRON_SECRET>` を送ります。
- 手動確認は `GET /api/reminders/digest?dryRun=1` を使います。
- 同じ `list_id` と `delivery_date` の送信は `reminder_delivery_logs` で二重送信を防ぎます。

## デプロイ

- MDのみの変更ではデプロイしません。
- コード変更はローカルで `npm test`、`npm run test:e2e`、`npm run build` を確認してから、本番反映の明示指示がある場合のみデプロイします。
- 秘密情報は `.env.local` と各サービスの環境変数にだけ保存し、GitHubへpushしません。
