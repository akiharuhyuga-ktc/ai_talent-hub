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
│   │   ├── lib/types/                # 型バレル（生成型 + UI 専用型）
│   │   ├── mocks/
│   │   │   ├── data/                 # seed data（テーブル別 JSON）
│   │   │   │   ├── members/          #   1 ファイル = 1 メンバー
│   │   │   │   ├── projects/         #   1 ファイル = 1 プロジェクト配分
│   │   │   │   ├── goals/            #   1 ファイル = 1 目標
│   │   │   │   ├── one-on-ones/      #   1 ファイル = 1 記録
│   │   │   │   └── reviews/          #   1 ファイル = 1 評価
│   │   │   ├── db.ts                 # MockDatabase（JSON 読込 + localStorage 永続化）
│   │   │   ├── handlers.ts           # MSW ハンドラー（開発時）
│   │   │   └── demo-mock.ts          # Tauri 用モック（リリース時）
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

### アーキテクチャ

```
第一弾（スタンドアロン）             第二弾（AWS）
Frontend (React)                  Frontend (React)
    ↓ /api/members                    ↓ /api/members
MSW handlers                      実 API (Go)
    ↓                                 ↓
MockDatabase (JSON → in-memory)   Go backend → MySQL
    ↓ 永続化
localStorage
```

フロントエンドは常に `/api/members` 等の API を呼ぶ。第一弾では MSW がインターセプトしてローカルデータを返し、第二弾では MSW を外して実 API に繋ぐだけで移行できる。

### データ構成（スタンドアロン版）

データは MySQL テーブルと 1:1 対応するディレクトリ・ファイルで管理する。1 ファイル = 1 レコード。

```
frontend/src/mocks/data/
├── members/                          # members テーブル
│   ├── mbr_demo_tanaka_tanaka-taro.json
│   ├── mbr_demo_suzuki_suzuki-hanako.json
│   └── mbr_demo_yamamoto_yamamoto-kenta.json
├── projects/                         # project_allocations テーブル
│   ├── proj_tanaka_kinto.json
│   ├── proj_tanaka_rd.json
│   └── ...
├── goals/                            # goals テーブル
│   ├── goal_demo_tanaka_h1.json
│   └── goal_demo_suzuki_h1.json
├── one-on-ones/                      # one_on_ones テーブル
│   ├── oo_demo_tanaka_2604.json
│   └── oo_demo_suzuki_2604.json
├── reviews/                          # reviews テーブル
│   └── rev_demo_tanaka_25h2.json
├── ai-responses.json                 # AI応答テンプレート
└── org-docs.json                     # 組織方針・基準・ガイドライン
```

### ID 体系

全エンティティに ULID ベースの接頭辞付き ID を付与する。

| エンティティ | 接頭辞 | 例 |
|---|---|---|
| Member | `mbr_` | `mbr_demo_tanaka` |
| Project | `proj_` | `proj_tanaka_kinto` |
| Goal | `goal_` | `goal_demo_tanaka_h1` |
| OneOnOne | `oo_` | `oo_demo_tanaka_2604` |
| Review | `rev_` | `rev_demo_tanaka_25h2` |

リレーションは `memberId` フィールドで紐付ける（MySQL の FK と同じ）。

### 型定義の流れ

```
openapi/openapi.json          ← Single Source of Truth
    ↓ make gen-api
frontend/src/api/generated/   ← Orval が生成した TS 型 + React Query hooks
    ↓ re-export
frontend/src/lib/types/
    ├── index.ts              ← バレル（API 生成型 + Wizard UI 型を re-export）
    └── wizard.ts             ← UI 専用型（手書き、OpenAPI に含めない）
```

### データ構造を変更するとき

1. **`openapi/openapi.json` のスキーマを編集**
   - `components/schemas/` にあるスキーマ定義を変更
   - テーブルレコード型: `MemberRecord`, `ProjectRecord`, `GoalsData`, `OneOnOneRecord`, `ReviewData`
   - API レスポンス型: `MemberSummary`, `MemberDetail` 等

2. **型を再生成**
   ```bash
   make gen-api
   ```

3. **seed data の JSON を更新**
   - `frontend/src/mocks/data/` 内の該当 JSON ファイルを編集
   - フィールドの追加・変更に合わせてレコードを更新

4. **MockDatabase を更新**（必要な場合）
   - `frontend/src/mocks/db.ts` の JOIN ロジックやWrite メソッドを修正

5. **ビルド確認**
   ```bash
   make build
   ```

### 永続化

- UI から追加・変更したデータは `localStorage` に保存される（ページリロードしても維持）
- `mockDb.reset()` で seed data（JSON ファイル）の初期状態にリセット可能
- 第二弾（AWS）移行時は localStorage → MySQL に置き換わる

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
