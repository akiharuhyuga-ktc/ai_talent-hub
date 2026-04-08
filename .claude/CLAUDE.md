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

## プロジェクト固有の注意点

- AI 機能は Anthropic Claude SDK (`@anthropic-ai/sdk`) を使用。呼び出しは `lib/ai/` に集約。
- メンバーデータは Markdown ファイル（frontmatter + 本文）で管理。パーサーは `lib/parsers/`。
- AI プロンプトテンプレートは `lib/prompts/` に配置。
- コミットメッセージ: 日本語 OK
