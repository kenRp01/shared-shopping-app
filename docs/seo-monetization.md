# SEO・広告収益化メモ

ShareShopiはCloudflare Workers + OpenNextで配信するため、SEOと広告はCloudflare Workerの環境変数で切り替えます。広告IDを設定しない場合、広告スクリプトと広告枠は表示されません。

## 実装済み

- 共通メタデータ、OGP、Twitter Card
- `/robots.txt`
- `/sitemap.xml`
- `/ads.txt`
- `/llms.txt`
- `/about`
- Google AdSenseスクリプトの遅延読み込み
- ログイン・規約・プライバシー・問い合わせページの広告枠

## Cloudflareに設定する値

Cloudflare Dashboardの `Workers & Pages > app > Settings > Variables and Secrets` で設定します。

通常のVariables:

- `NEXT_PUBLIC_SITE_URL`: 本番URL。例: `https://app.shareshopi.workers.dev`
- `NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT`: AdSenseのクライアントID。例: `ca-pub-xxxxxxxxxxxxxxxx`
- `NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_HOME`: トップページ用の広告ユニットID
- `NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_LOGIN`: ログインページ用の広告ユニットID
- `NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_LEGAL`: 規約・プライバシー・問い合わせページ用の広告ユニットID
- `GOOGLE_ADSENSE_PUBLISHER_ID`: ads.txt用のサイト運営者ID。例: `pub-xxxxxxxxxxxxxxxx`

Secrets:

- `RESEND_API_KEY`
- `CRON_SECRET`

`REMINDER_FROM_EMAIL` は秘密情報ではないため通常のVariablesで管理します。

## AdSense側の作業

1. Google AdSenseでサイトを追加する。
2. 審査対象URLに本番URLまたは独自ドメインを登録する。
3. AdSenseの広告コードから `ca-pub-...` を確認し、`NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT` に設定する。
4. 広告ユニットを作成し、広告枠IDを `NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_HOME`、`NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_LOGIN`、`NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_LEGAL` に設定する。
5. `pub-...` を `GOOGLE_ADSENSE_PUBLISHER_ID` に設定し、`/ads.txt` が `google.com, pub-..., DIRECT, f08c47fec0942fa0` を返すことを確認する。
6. `npm run cf:deploy` で再デプロイする。

## Search Console側の作業

1. Google Search Consoleに本番URLまたは独自ドメインを追加する。
2. 所有権確認を行う。
3. サイトマップとして `/sitemap.xml` を送信する。
4. `/robots.txt` で `/lists/`、`/invite/`、`/public/`、`/api/` がクロール対象外になっていることを確認する。

## AI検索向けの作業

AI検索で要約されやすくするため、検索対象の公開ページに「何のサービスか」「誰向けか」「主な機能」を明確に書きます。

- `/about`: ShareShopiの説明、機能、AI検索向け要約、FAQ構造化データを掲載する。
- `/llms.txt`: LLM向けに、公開ページ、非公開ルート、推奨説明文を明記する。
- `/robots.txt`: `/about` と `/llms.txt` は許可し、ユーザー固有の `/lists/`、`/invite/`、`/public/`、`/api/` は引き続きクロール対象外にする。
- `/sitemap.xml`: `/about` を含め、Search Consoleから再送信する。

AI検索はサービスごとに採用基準が異なるため、`llms.txt` だけで掲載が保証されるものではありません。Google検索に載る公開ページを丁寧に整えることを主軸にします。

## 注意点

- 買い物リスト本体はユーザー固有データのため、検索インデックス対象にしません。
- `/` は検索向けの公開LP、`/app` はアプリ起動用のリダイレクトページとして分けています。
- `/about` はAI検索や比較検索で要約されやすい説明ページとして使います。
- 招待リンク、公開リンク、APIは `noindex` または `robots.txt` で検索対象外にします。
- AdSense審査には、利用規約、プライバシーポリシー、問い合わせ導線、十分な公開コンテンツが必要です。
- 広告をアプリ操作画面に置く場合は、誤タップやUX悪化を避けるため別途UI確認します。
