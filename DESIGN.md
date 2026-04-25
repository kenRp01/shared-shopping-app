---
name: ShareShopi
colors:
  primary: "#1B2A41"
  accent: "#F26B5B"
  neutral: "#F7F5EF"
  surface: "#FFFDFC"
  success: "#DFF5E8"
  warning: "#FFF0D8"
  line: "#DDD6CC"
typography:
  h1:
    fontFamily: M PLUS Rounded 1c
    fontSize: 2.9rem
    fontWeight: 800
  h2:
    fontFamily: M PLUS Rounded 1c
    fontSize: 1.6rem
    fontWeight: 700
  body:
    fontFamily: Noto Sans JP
    fontSize: 1rem
    lineHeight: 1.7
rounded:
  sm: 12px
  md: 20px
  lg: 32px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
---

## Overview

家族や同居人が、迷わず同じ買い物リストを見られることを最優先にしたデザインです。主役は「状態」と「誰が入れたか」で、説明文や操作は主張しすぎないようにします。

## Colors

- **Primary:** 見出しと主要ボタンに使う濃いインク色。
- **Accent:** 今日の期限や重要な行動を示す一色だけのアクセント。
- **Success:** 購入済みの穏やかな背景色。
- **Warning:** 期限切れの注意表示に使う色。

## Components

- リスト項目は左から状態、商品名、期限、追加者バッジの順で配置する。
- 主要CTAは常に1画面1つに絞り、他は輪郭ボタンにする。
- 共有状態は `共有中` と `公開中` のバッジで即座に見分けられるようにする。
