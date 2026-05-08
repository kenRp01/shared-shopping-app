# ShareShopi アーキテクチャ検討メモ

このドキュメントは、ShareShopi の技術選定と運用判断をあとから見返せるように残すメモです。現時点の優先順位は「限定ベータを無料に近い構成で安全に公開すること」です。

## 基本方針

- モバイルでの買い物中利用を最優先にする。
- 個人利用はログイン不要で始められるようにする。
- 共有、複数端末、本番運用が必要な機能は Supabase に寄せる。
- 認証、DB、メール送信を自前実装しない。
- 秘密情報は Vercel / Supabase / ローカル `.env.local` にだけ置き、GitHubへ残さない。
- MDのみの変更ではデプロイしない。
- コード変更はローカル確認後、明示指示がある場合だけ本番デプロイする。

## 採用構成

| 領域 | 採用 | 理由 |
| --- | --- | --- |
| フロントエンド | Next.js App Router | Vercel との相性がよく、API Route と画面を同じリポジトリで管理できるため。 |
| ホスティング | Vercel Hobby | 限定ベータを無料に近く開始でき、Next.js のデプロイが簡単なため。 |
| DB | Supabase Postgres | 共有リスト、メンバー、商品、リマインドログをRDBで扱いやすいため。 |
| 認証 | Supabase Auth | Google OAuth / メールログインを自前で持たずに実装できるため。 |
| メール送信 | Resend | APIがシンプルで、問い合わせ・リマインド通知を無料枠から始められるため。 |
| E2E | Playwright | モバイルUI、ゲスト利用、フォーム、共有導線を自動確認しやすいため。 |

## 認証方針

共有機能はログイン必須、個人利用はログイン不要にします。

- Googleログインは Supabase Auth の Google Provider を使う。
- メールアドレスログインも代替手段として Supabase Auth で残す。
- パスワードはアプリDBに保存しない。
- Supabase Auth がパスワード管理とハッシュ化を担当する。
- ゲスト利用のデータはローカル保存を前提にし、共有機能は使えない。

Google OAuth の設定では、Google Cloud 側の Redirect URI は Supabase の callback URL にします。

```text
https://<supabase-project-ref>.supabase.co/auth/v1/callback
```

Supabase 側の Redirect URLs にはアプリ側の callback URL を登録します。

```text
http://localhost:3001/auth/callback
http://127.0.0.1:3001/auth/callback
https://shareshopi.vercel.app/auth/callback
```

## データ管理方針

Supabase 側では以下を中心に管理します。

- `profiles`: ユーザー表示名、メール。
- `shopping_lists`: リスト、公開設定、所有者、通知設定。
- `shopping_list_members`: 共有メンバーと権限。
- `shopping_items`: 商品、数量、日付、追加者、購入状態。
- `reminder_delivery_logs`: 日次リマインドの二重送信防止。

リスト削除や共有設定など、権限が重要な操作は API Route 側で所有者確認を行います。クライアントから直接DB削除する処理は避けます。

## メール送信方針

問い合わせフォームとリマインド通知は Resend を使います。

- `RESEND_API_KEY`: Resend APIを呼ぶための秘密鍵。
- `REMINDER_FROM_EMAIL`: メール送信元。
- 問い合わせ送信先: `yqxxnaxr1109@gmail.com`。

問い合わせフォームでは、ユーザーが入力したメールアドレスを `reply_to` に設定します。これにより、管理者は届いたメールへそのまま返信できます。

Resend Free は小規模ベータでは十分ですが、送信数に上限があります。2026年5月時点の公式ページでは、Freeプランは月3,000通、1日100通が目安です。リマインド利用者が増えると上限に到達する可能性があるため、週次で送信数を確認します。

## リマインド方針

無料運用を優先し、商品ごとの即時通知ではなく、日次のまとめ通知にします。

- Vercel Cron が `GET /api/reminders/digest` を1日1回実行する。
- 対象は未購入の商品だけにする。
- 今日が期限の商品と期限切れの商品をまとめる。
- `reminder_delivery_logs` で同日二重送信を防ぐ。
- 公開リンク閲覧者にはメール通知しない。

## 無料運用の判断

限定ベータでは以下の無料枠を前提にします。

- Vercel Hobby
- Supabase Free
- Resend Free

ただし、Vercel Hobby は個人・非商用向けです。商用利用や一般公開で利用者が増える段階では、Cloudflare 移行、Vercel有料化、Supabase有料化、メール送信基盤の見直しを別途判断します。

## 将来の見直しポイント

- 商用化前に Vercel Hobby の継続可否を判断する。
- Cloudflare Pages / Workers への移行可否を検討する。
- Resend の送信数が増えたら有料化または別サービスを検討する。
- Supabase Free のDB容量、Authユーザー数、API制限を確認する。
- 共有ユーザーが増えたら RLS と API Route の権限テストを拡充する。
- UIが安定したら、Playwright E2Eを本番URLのスモークテストにも広げる。

## 現時点で採用しないもの

- OCR、画像アップロード、レシート解析。
- 個別時刻ぴったりのプッシュ通知。
- LINE通知やネイティブアプリ通知。
- 自前のパスワード管理。
- 未登録メールへの招待メール送信。
- 全体公開のリスト検索ページ。

これらは無料運用と実装複雑度の面で、限定ベータのスコープ外にします。
