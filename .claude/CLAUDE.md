# KTC Talent Hub

AI を活用したタレントマネジメントアプリケーション。メンバーの目標管理、評価、1on1、チーム方針策定をサポートする。

## リポジトリ構成

README.md を参照。補足:
- `old/` は廃止済みアーカイブ。触らない。
- `data/.demo-mode.json` の `enabled` フラグでデモ/本番データを切替（`true` → `data/demo-members`、`false` → `data/members`）

## 開発コマンド

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
npm run build    # 本番ビルド
npm run lint     # ESLint
```

## 指摘事項の管理

### セッション開始時
- `tmp/feedback.md`が存在する場合、**必ず読み込んでから作業を開始する**
- 「過去の指摘事項を読み込みました」と報告する

### 指摘を受けた時
- ユーザーから指摘・修正依頼を受けたら、`tmp/feedback.md`に以下の形式で追記する:
  ```
  ### YYYY-MM-DD: 指摘の要約
  - **状況**: 何をしていた時に発生したか
  - **問題**: 何が間違っていたか
  - **原因**: なぜ間違えたか
  - **対策**: 次回どうすべきか
  ```
- 既存の内容は削除せず、末尾に追記する

## プロジェクト固有の注意点

- AI 機能は Anthropic Claude SDK (`@anthropic-ai/sdk`) を使用。呼び出しは `lib/ai/` に集約。
- メンバーデータは Markdown ファイル（frontmatter + 本文）で管理。パーサーは `lib/parsers/`。
- AI プロンプトテンプレートは `lib/prompts/` に配置。
- コミットメッセージ: 日本語 OK
