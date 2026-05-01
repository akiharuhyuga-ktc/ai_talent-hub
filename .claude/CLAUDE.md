# KTC Talent Hub

AI を活用したタレントマネジメントアプリケーション。メンバーの目標管理、評価、1on1、チーム方針策定をサポートする。

## リポジトリ構成

README.md を参照。補足:
- `archived_frontend/` — ローカル運用中の Next.js アプリ（現在使用中）
- `frontend/` — 新アプリ（Vite + Go バックエンド + Tauri デスクトップ対応、開発中）
- `web-demo/` — リポジトリに含まれる旧デモ用ソース。現在は `archived_frontend/` を使うため触らない
- `data/.demo-mode.json` の `enabled` フラグでデモ/本番データを切替（`true` → `data/demo-members`、`false` → `data/members`）

## タレントハブ起動手順（archived_frontend）

```bash
# 1. ポート確認（すでに起動中なら不要）
lsof -ti :3000

# 2. 起動
cd archived_frontend
npm run dev      # http://localhost:3000

# クリーンビルドが必要な場合（実装変更後など）
rm -rf .next && npm run dev
```

ブラウザは自動で開かないので `open http://localhost:3000` で開く。

## その他の開発コマンド（archived_frontend）

```bash
cd archived_frontend
npm run build    # 本番ビルド確認
```

## GitHub 認証

git push / PR 作成は `akiharuhyuga-ktc` アカウントで行う。

```bash
gh auth switch --user akiharuhyuga-ktc
```

## 作業前チェックルール（必須）

### すべての作業共通
1. **CLAUDE.md とメモリを最初に確認する** — 起動手順・認証方法・既知の注意点はここに書いてある。推測で動かない。
2. **わからなければ推測せず質問する** — 間違った方向に進んでから気づくより、先に確認する。

### データ更新時（メンバー目標・プロフィール等）
1. **他のメンバーの同種ファイルを必ず先に確認する** — フォーマット・構造・項目名を揃える。
2. **提供されたテキストをそのまま貼り付けない** — 既存のフォーマットに合わせて差分のみ適用する。

## プロジェクト固有の注意点

- AI 機能は Anthropic Claude SDK (`@anthropic-ai/sdk`) を使用。呼び出しは `lib/ai/` に集約。
- メンバーデータは Markdown ファイル（frontmatter + 本文）で管理。パーサーは `lib/parsers/`。
- AI プロンプトテンプレートは `lib/prompts/` に配置。
- コミットメッセージ: 日本語 OK
