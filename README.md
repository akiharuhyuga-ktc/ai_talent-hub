# KTC Talent Hub

AI を活用したタレントマネジメントアプリケーション。メンバーの目標管理、評価、1on1、チーム方針策定をサポートする。

## 技術スタック

### Frontend

| カテゴリ | 技術 | バージョン |
|---------|------|-----------|
| UI ライブラリ | React | 19.2.4 |
| 言語 | TypeScript | ~5.9.3 |
| ビルドツール | Vite (SWC) | 7.3.1 |
| スタイリング | Tailwind CSS | 4.2.1 |
| ルーティング | TanStack Router (ファイルベース) | 1.162.6 |
| データフェッチ | TanStack React Query | 5.90.21 |
| HTTP クライアント | Axios | 1.13.5 |
| リンター / フォーマッター | Biome | 2.4.4 |
| テスト | Vitest + Testing Library | 4.0.18 |
| API モック | MSW (Mock Service Worker) | 2.12.10 |
| パッケージマネージャ | pnpm | latest |

### Backend

| カテゴリ | 技術 | バージョン |
|---------|------|-----------|
| 言語 | Go | 1.26 |
| HTTP サーバー | net/http (標準ライブラリ) | - |
| ホットリロード | Air | latest |

### コード生成

| 対象 | ツール | 入力 | 出力 |
|-----|--------|------|------|
| Frontend | Orval | `openapi/openapi.json` | React Query hooks + TypeScript 型 (`frontend/src/api/generated/`) |
| Backend | oapi-codegen | `openapi/openapi.json` | Go ServerInterface + モデル型 (`backend/internal/api/openapi.gen.go`) |
| OpenAPI Lint | Redocly CLI | `openapi/openapi.json` | - |

### インフラ

| カテゴリ | 技術 |
|---------|------|
| コンテナ | Docker Compose |
| Frontend コンテナ | node:24-alpine |
| Backend コンテナ | golang:1.26-alpine + Air |
| AI SDK | Anthropic Claude SDK (`@anthropic-ai/sdk`) |

## リポジトリ構成

```
ktc-talent-hub/
├── openapi/                    # OpenAPI スペック（Frontend/Backend 共通）
│   └── openapi.json
├── backend/                    # Go バックエンド
│   ├── main.go                 #   エントリーポイント
│   ├── internal/api/           #   生成コード（ServerInterface + 型）
│   ├── oapi-codegen.yaml       #   コード生成設定
│   ├── .air.toml               #   ホットリロード設定
│   └── Dockerfile
├── frontend/                   # React フロントエンド
│   ├── src/
│   │   ├── api/
│   │   │   ├── custom-instance.ts    # Axios 設定
│   │   │   └── generated/            # 生成コード（hooks + 型）
│   │   ├── routes/                   # ファイルベースルーティング
│   │   ├── main.tsx                  # エントリーポイント
│   │   └── index.css                 # Tailwind CSS
│   ├── orval.config.ts         #   コード生成設定
│   ├── biome.json              #   Linter / Formatter 設定
│   ├── vite.config.ts          #   Vite 設定（API プロキシ含む）
│   └── Dockerfile
├── scripts/                    # セットアップスクリプト
├── docker-compose.yml          # 開発環境定義
├── Makefile                    # 開発コマンド
└── .claude/                    # Claude Code 設定
```

## セットアップ

```bash
make setup    # .env.local 作成 + 依存インストール
```

## 開発

```bash
# Docker Compose でフルスタック起動
make dev              # http://localhost:5173 (Frontend) / :8080 (Backend)
make dev-build        # イメージ再ビルドして起動

# 個別起動（Docker 不要）
npm run dev:frontend  # Vite dev server
npm run dev:backend   # Go server
```

## コード生成

OpenAPI スペック (`openapi/openapi.json`) を編集後:

```bash
make gen-api            # Frontend + Backend 両方生成
make gen-api-frontend   # Frontend のみ（Orval → React Query hooks）
make gen-api-backend    # Backend のみ（oapi-codegen → Go interface）
```

### 開発フロー

1. `openapi/openapi.json` にエンドポイントを定義
2. `make gen-api` でクライアント・サーバーコードを生成
3. Backend: 生成された `ServerInterface` を実装
4. Frontend: 生成された hooks を使って UI を実装

## 品質チェック

```bash
make lint          # Biome lint
make lint-api      # OpenAPI スペック lint (Redocly)
make typecheck     # TypeScript 型チェック
make test          # テスト実行
make quality       # lint + typecheck + test まとめて実行
```

## 設定ファイル一覧

| ファイル | 用途 |
|---------|------|
| `openapi/openapi.json` | API スペック定義（OpenAPI 3.0.3） |
| `frontend/orval.config.ts` | Frontend コード生成設定 |
| `backend/oapi-codegen.yaml` | Backend コード生成設定 |
| `frontend/vite.config.ts` | Vite 設定（プラグイン、プロキシ、パスエイリアス `@/`） |
| `frontend/biome.json` | Linter / Formatter ルール |
| `frontend/tsconfig.app.json` | TypeScript 設定（strict、ES2022） |
| `frontend/vitest.config.ts` | テスト設定（jsdom 環境） |
| `backend/.air.toml` | Go ホットリロード設定 |
| `docker-compose.yml` | 開発コンテナ定義 |
| `.env.local` | 環境変数（API キー等、gitignore 済み） |

## データ管理

- メンバーデータは Markdown ファイル（YAML frontmatter + 本文）で管理
- パーサーは `lib/parsers/` に配置
- `data/.demo-mode.json` の `enabled` フラグでデモ/本番データを切替
  - `true` → `data/demo-members`
  - `false` → `data/members`

## 環境変数

`.env.local.example` を参照。主な設定:

```env
# Anthropic API（直接）
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Azure Foundry 経由
ANTHROPIC_FOUNDRY_API_KEY=your-foundry-api-key
ANTHROPIC_FOUNDRY_RESOURCE=your-resource-name
ANTHROPIC_FOUNDRY_BASE_URL=https://your-resource.services.ai.azure.com/anthropic
DEPLOYMENT_NAME=your-deployment-name
```
