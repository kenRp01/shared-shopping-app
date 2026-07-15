# ShareShopi アーキテクチャ検討メモ

ShareShopi の現行アーキテクチャと運用判断を残すメモです。実装は Cloudflare 中心の構成へ移行済みで、このドキュメントもその前提に揃えます。

## 基本方針

- モバイルでの買い物中利用を最優先にする。
- 個人利用はログイン不要で始められるようにする。
- 共有、複数端末、本番運用が必要な機能は Cloudflare D1 と Firebase Auth に寄せる。
- 認証、DB、メール送信を自前実装しない。
- 秘密情報は `.env.local`、`.dev.vars`、Cloudflare Secrets だけに置き、GitHubへ残さない。
- ドキュメントだけの変更ではデプロイしない。
- コード変更はローカル確認後、明示指示がある場合だけ本番デプロイする。

## 現行構成

| 領域 | 採用 | 理由 |
| --- | --- | --- |
| Frontend / API | Cloudflare Workers + OpenNext | Next.js App Router を維持しつつ、画面とAPIを同じWorkerで運用できるため。 |
| DB | Cloudflare D1 | Worker と同じCloudflare基盤で共有リスト、商品、メンバー、招待リンクをRDBとして扱えるため。 |
| Auth | Firebase Auth | Googleログイン、メールログイン、メール認証、セッション管理を自前実装せずに使えるため。 |
| Mail | Resend | 問い合わせ、招待、日次リマインドなどのトランザクションメールをAPI経由で送れるため。 |
| Scheduler | Cloudflare Cron Triggers | 日次リマインドをWorkerのscheduled handlerで実行できるため。 |
| E2E | Playwright | モバイルUI、ゲスト利用、フォーム、共有導線を自動確認しやすいため。 |

## 認証方針

共有機能はログイン必須、個人利用はログイン不要にします。

- Googleログインとメールアドレスログインは Firebase Auth を使う。
- パスワードはアプリDBに保存しない。
- APIは Firebase ID Token を検証し、メール未認証ユーザーは更新系APIを拒否する。
- D1 の `profiles.firebase_uid` と Firebase UID を対応付ける。
- ゲスト利用のデータは IndexedDB を前提にし、共有機能は使えない。

Firebase Auth の Authorized domains には、ローカル確認用URL、本番Worker URL、将来の独自ドメインを登録します。

## データ管理方針

Cloudflare D1 では以下を中心に管理します。

- `profiles`: ユーザー表示名、メール、Firebase UID。
- `shopping_lists`: リスト、公開設定、所有者、通知設定。
- `shopping_list_members`: 共有メンバーと権限。
- `shopping_items`: 商品、数量、日付、追加者、購入状態。
- `shopping_list_invites`: 招待リンク用トークンのハッシュ、有効期限。
- `reminder_delivery_logs`: 日次リマインドの二重送信防止。

権限が重要な操作は API 層で所有者または共有メンバー確認を行います。クライアントから直接DBを更新する処理は置きません。

## メール送信方針

問い合わせフォームとリマインド通知は Resend を使います。

- `RESEND_API_KEY`: Resend APIを呼ぶための秘密鍵。
- `REMINDER_FROM_EMAIL`: メール送信元。
- `CRON_SECRET`: Cron経由APIを保護する共有シークレット。
- 問い合わせ送信先: `yqxxnaxr1109@gmail.com`。

問い合わせフォームでは、ユーザーが入力したメールアドレスを `reply_to` に設定します。管理者は届いたメールへそのまま返信できます。

## リマインド方針

無料運用を優先し、商品ごとの即時通知ではなく、日次のまとめ通知にします。

- Cloudflare Cron Triggers が毎日08:00 JSTにWorkerの `scheduled()` を実行する。
- `scheduled()` は内部的にリマインド処理を呼び出す。
- 対象は未購入の商品だけにする。
- 今日が期限の商品と期限切れの商品をまとめる。
- `reminder_delivery_logs` で同日二重送信を防ぐ。
- 公開リンク閲覧者にはメール通知しない。

## 開発と型生成

Cloudflare binding の型は生成物なのでGit管理しません。設定変更後やCIでは、古い型が残らないように必ず再生成します。

```bash
npm run cf:typegen
```

主な確認コマンド:

```bash
npm test
npx tsc --noEmit
npm run build
npm run cf:build
```

## 無料運用の判断

現時点では以下を前提に無料運用を目指します。

- Cloudflare Workers
- Cloudflare D1
- Firebase Auth
- Resend Free
- Cloudflare Cron Triggers

無料枠には上限があるため、公開後は Workerリクエスト数、D1使用量、Firebase Auth利用量、Resend送信数を週次で確認します。

## 将来の見直しポイント

- 利用者増加時に Cloudflare の有料プランが必要か判断する。
- 独自ドメイン取得とメール送信元ドメイン認証を検討する。
- Resend の送信数が増えたら有料化または別サービスを検討する。
- 共有ユーザーが増えたら権限テストとE2Eを拡充する。
- 商用化時は課金方式、利用規約、プライバシーポリシー、サポート導線を再確認する。

## 現時点で採用しないもの

- OCR、画像アップロード、レシート解析。
- 個別時刻ぴったりのプッシュ通知。
- LINE通知やネイティブアプリ通知。
- 自前のパスワード管理。
- 全体公開のリスト検索ページ。

これらは無料運用と実装複雑度の面で、現在のスコープ外にします。
