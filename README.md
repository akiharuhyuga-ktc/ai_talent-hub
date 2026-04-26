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
第一弾（スタンドアロン / 現在）         第二弾（AWS）
Frontend (React)                      Frontend (React)
    ↓ dataStore (members / goals / 1on1 / reviews)
    │                                     ↓ /api/...
    ├─ ブラウザ dev: /api/fs/*  → fs-api  実 API (Go)
    │  プラグイン (vite-plugins/fs-api.ts)     ↓
    └─ Tauri: @tauri-apps/plugin-fs       Go backend → MySQL
       ↓
    data/v1/  (ホスト FS の Markdown ファイル)
```

メンバー / 目標 / 1on1 / 評価のマスターは `data/v1/` 配下の Markdown ファイル。フロントエンドは `dataStore` 抽象（`frontend/src/lib/data-store/`）を介して読み書きし、その下で dev は HTTP fs-api、Tauri は plugin-fs に分岐する。

AI 応答モックと組織ドキュメントは `frontend/src/mocks/db.ts` の in-memory ストアが提供する（`/api/*` を MSW で傍受）。

### `data/v1/` の構造

```
data/v1/
├── members/                          # 本番データ
│   └── <member-id>/                  # ディレクトリ名 = メンバー ID
│       ├── profile.md                #   基本情報（ID コメント埋込）
│       ├── goals/<period>.md         #   期ごとの目標（例: 2026-h1.md）
│       ├── one-on-one/<YYYY-MM>.md   #   月ごとの 1on1
│       └── reviews/<period>.md       #   期ごとの評価
└── demo-members/                     # 開発時デモモード用の作業領域（後述）
    └── <member-id>/                  # 構造は members/ と同じ
        └── ...
```

#### 命名規則

- **メンバーディレクトリ名 = ID**（例: `mbr_mof1htgkyyyol9/`）
  - 同姓同名・URL エンコード・FS の正規化差異（NFC/NFD）を避けるため
  - 表示名は `profile.md` の `名前：` 行から取る
- **goals / reviews のファイル名**: 期間キー（例: `2026-h1.md`）
- **one-on-one のファイル名**: 年月（例: `2026-04.md`）

#### `profile.md` フォーマット

```markdown
# {表示名}

- 名前：{表示名}
- 役職：{役職}
- チーム：{チーム}
- チーム分類：{Flutter | Backend | ...}
- 入社年：{YYYY-MM}
- メインプロジェクト：{プロジェクト名}
- R&D配分：{0-100}%

<!-- id: mbr_xxxxxxxxxxxx -->
<!-- slug: {表示名から自動生成} -->
```

ディスク上のディレクトリ名がカノニカルな ID。`<!-- id: ... -->` コメントは自己記述用で、両者が食い違った場合はディレクトリ名を採用する。

### ID 体系

全エンティティに接頭辞付き ID を付与する。

| エンティティ | 接頭辞 | 例 |
|---|---|---|
| Member | `mbr_` | `mbr_mof1htgkyyyol9` |
| Goal | `goal_` | `goal_<memberId>_<period>` |
| OneOnOne | `oo_` | `oo_<memberId>_<YYYYMM>` |
| Review | `rev_` | `rev_<memberId>_<period>` |

Member ID は `generateMemberId()`（`frontend/src/lib/data-store/markdown.ts`）で生成（`mbr_` + base36 タイムスタンプ + base36 ランダム）。Goal / OneOnOne / Review の ID は決定論的に組み立てており、リレーションは `memberId` フィールドで紐付ける。

### 機密性ルール（最重要）

`data/`（`data/v1/` 含む）は個人情報・評価・方針等を含むローカル専用データ。**コミット・push しない**。

- `.gitignore` の `data/` パターンで明示的に除外している。このルールは緩めない（除外例外 `!data/...` を加えない）
- `git add .` / `git add -A` のような広域追加は避け、必要なファイルだけ個別に add する
- seed/mock データが欠けても起動できるよう、フロント側はフォールバック実装にする（`frontend/src/mocks/db.ts` 参照）
- サンプル共有が必要な場合は `.example` サフィックス付きの別パスにする

### 開発時デモモード

開発作業で実データ（`data/v1/members/`）を破壊しないための切替機構。dev ビルドでのみ有効、本番／Tauri リリースでは強制 OFF。

```
frontend/src/mocks/seeds/members/    ← commit 可。架空データの seed
data/v1/demo-members/                ← gitignore 済。各自の作業領域
```

- サイドバーの「デモモード」トグルで切替（dev ビルドのみ表示）
- ON にすると `dataStore` は `data/v1/demo-members/` を参照
- `demo-members/` が空のときは起動時 / 初回アクセス時に `frontend/src/mocks/seeds/members/` から自動コピー
- 編集はすべて `demo-members/` に書かれ、本番データには影響しない
- リセット: `make demo-reset`（`data/v1/demo-members/` を削除 → 次回起動で再 seed）
- AI 応答（Anthropic API）はデモモードでも実 API を呼ぶ。出力は `demo-members/` に保存されるため実データは汚染されない

seed のスキーマは `profile.md` 等のフォーマット変更時に追従させる必要がある。

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

3. **dataStore / fs-api の更新**（必要な場合）
   - パース・シリアライズ: `frontend/src/lib/data-store/markdown.ts`
   - HTTP API: `frontend/vite-plugins/fs-api.ts`
   - dev / Tauri ストア: `frontend/src/lib/data-store/{dev-http,tauri-fs}.ts`

4. **ビルド確認**
   ```bash
   make build
   ```

### 永続化

- UI から追加・変更したデータは `data/v1/` 配下に Markdown として書き戻される（dev: fs-api 経由、Tauri: plugin-fs 経由）
- 第二弾（AWS）移行時は `dataStore` の実装を実 API クライアントに差し替えるだけで済む

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
