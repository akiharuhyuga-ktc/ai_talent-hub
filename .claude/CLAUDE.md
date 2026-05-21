# KTC Talent Hub

AI を活用したタレントマネジメントアプリケーション。メンバーの目標管理、評価、1on1、チーム方針策定をサポートする。

## リポジトリ構成

README.md を参照。補足:
- `old/` は廃止済みアーカイブ。触らない。
- `archived_frontend/` は Next.js 版の旧フロントエンド。現 frontend とは独立しており、`data/members/`, `data/demo-members/`, `data/.demo-mode.json` を参照する。触らない。
- **現 frontend（Vite + React SPA）のデータは `data/v1/` 配下**。`data/v1/.demo-mode.json` の `enabled` フラグでデモ/本番データを切替（`true` → `data/v1/demo-members`、`false` → `data/v1/members`）。

## ローカルデータの機密性（最重要）

**`data/`（`data/v1/` 含む）および `frontend/src/mocks/data/` 以下は極めて機密性の高いローカル専用データを含む。絶対にコミット・push してはならない。**

- これらは各開発者がローカルで持つ個人情報・評価・方針等を含むため、`.gitignore` の `data/` パターンで明示的に除外している
- 原則として `.gitignore` の `data/` 関連ルールを緩める・除外例外（`!data/...`）を追加するような変更は行わない
- `git add` 時に `data/` 配下のファイルが含まれないことを必ず確認する。`git add .` や `git add -A` のような広域追加はこの領域では避ける
- seed/mock データが欠けていても起動できるようアプリ側（例: `frontend/src/mocks/db.ts`）はフォールバック実装にする。commit して埋める方向で解決しない
- サンプル共有が必要な場合は、実データとは別のサンプル用パス（例: `.example` サフィックス付き）を検討し、ユーザーに確認してから進める

## 開発コマンド

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # 本番ビルド
npm run lint     # Biome
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

- AI 機能は AWS Lambda (Bedrock streaming proxy) 経由。フロント側は `frontend/src/lib/ai/sseFetch.ts` の `aiSseRun` と `frontend/src/lib/ai/client.ts` の用途別関数 (`requestDiagnosis` 等) を使う。フロントから Anthropic / AWS の SDK を直接呼ばない（API キーは Lambda 側 env のみ保持）。
- メンバーデータは Markdown ファイル（frontmatter + 本文）で管理。パーサーは `frontend/src/lib/parsers/`。
- AI プロンプトテンプレートは `frontend/src/lib/ai/prompts/` に配置（バンドル既定値 + Lambda の `/api/ai/prompts` から取得した上書き値の stale-while-revalidate）。
- コミットメッセージ: 日本語 OK

## API エラー通知の規約

API 呼び出しが失敗した場合は **必ずユーザーに見える形で通知** する。silent failure は禁止。

- React Query 経由の呼び出し: `QueryClient` の `QueryCache.onError` / `MutationCache.onError` で `showApiErrorToast` を自動発火（`frontend/src/main.tsx`）。queryFn 内で try-catch して fallback を返す場合は、catch 内で明示的に `showApiErrorToast(err)` を呼ぶ
- AI クライアント: `frontend/src/lib/ai/sseFetch.ts` の `aiSseRun` 経由で呼べば、throw 前に自動でトースト通知される
- 抑止対象: `AbortError` (ユーザー中断) と 401 (AuthContext のセッション切れダイアログと衝突)

「とりあえず console.warn で済ませる」のは NG。気づけないバグの温床になる（`tmp/feedback.md` 2026-04-23 参照）。
