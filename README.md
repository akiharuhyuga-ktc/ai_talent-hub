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
| AI 経路 | AWS Lambda Function URL (Bedrock streaming) 経由 ※ API キーは Lambda 側のみ保持 |

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
- AI 応答もトグルに連動: ON ならモック固定応答 (MSW / window.fetch ラッパ)、OFF なら実 Lambda proxy へ流れる（詳細は「AI 統合」セクション参照）

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

## AI 統合

メンバー目標の診断・生成、評価コメント、1on1 サマリー、組織方針生成等の AI 機能は、専用の **AWS Lambda Function URL (Bedrock streaming proxy)** 経由で呼び出す。Anthropic / AWS の API キーは Lambda 側 env のみが保持し、クライアント (フロント / Tauri) には配布しない。

### 経路

```
Frontend (React / Tauri WebView)
    ↓ POST /api/ai/invoke  (Anthropic Messages 形式の JSON / SSE 受信)
    ↓ Headers:
    │   X-Bizport-Authorization: Bearer <Entra JWT>
    │   x-amz-content-sha256: <body の SHA256 hex>
CloudFront (OAC SigV4 で Lambda Function URL を署名)
    ↓
Lambda (talenthubAiProxy)  ※ bizport /api/v1/users/me で JWT 検証
    ↓ Bedrock InvokeModel (streaming)
Bedrock (global.anthropic.claude-sonnet-4-6)
```

- 認証ヘッダが標準の `Authorization` ではなく `X-Bizport-Authorization` なのは、CloudFront OAC for Lambda が viewer の `Authorization` を SigV4 値で上書きする仕様のため
- `x-amz-content-sha256` は Lambda Function URL OAC が POST に対して必須要求する (クライアントが body の SHA256 を計算して付与)
- レスポンスは Anthropic Messages 形式 SSE (`content_block_delta` の `delta.text` を逐次配信)

実装は `frontend/src/lib/ai/sseFetch.ts` に集約し、各ウィザード step は `frontend/src/lib/ai/client.ts` の用途別関数 (`requestDiagnosis` / `requestGoalGeneration` / `requestGoalRefinement` / `requestGoalEdit` / `requestEvalComment` / `requestOneOnOneQuestions` / `requestOneOnOneSummary` / `requestPolicyDirection` / `requestPolicyDraft` / `requestPolicyRefine` / `requestChat`) を呼ぶ。

### プロンプトテンプレート

Lambda 同梱 → クライアントキャッシュの **stale-while-revalidate** 方式。

- バンドル既定値: `frontend/src/lib/ai/prompts/defaults.ts` (オフライン / 初回起動でも動く fallback)
- サーバ取得: 起動時に `GET /api/ai/prompts` で最新版を取得し、`localStorage` (キー: `talent-hub.prompts.v1`) にキャッシュ
- 起動時はキャッシュを即時利用、裏で更新 → 次回呼び出しから新版が反映
- 取得失敗 / オフライン時はバンドル既定値で動作継続 (黙ってフォールバック)

Lambda パッケージにテンプレファイル群を同梱し、handler が module top-level で読み込んでメモリ保持。プロンプト更新 = Lambda 再デプロイ。

### 動作モード切替

AI 経路のモック / 実 proxy 切替は **画面サイドバーのデモモードトグル** (`DemoModeContext`、`localStorage.demoMode`) が master。`VITE_DEMO_MODE` は MSW を起動するかどうかだけを補助的に決める。

| 環境 | モック実装 | トグル ON | トグル OFF |
|---|---|---|---|
| ブラウザ (`npm run dev`) | MSW Service Worker | `/api/ai/invoke` を傍受しデモ応答 | `passthrough()` → Vite proxy `/api/ai` → 実 Lambda |
| Tauri (`make desktop-dev`) | `window.fetch` ラッパ (`demo-mock.ts`) | 傍受しデモ応答 | 原 `fetch` → Vite proxy `/api/ai` → 実 Lambda |
| production browser | 無効 | — | 実 Lambda へ直接 |

`VITE_DEMO_MODE=true` を立てれば production browser ビルドでも MSW を起動できる (社内デモ用)。dev 中は `VITE_DEMO_MODE` の値に関わらず MSW / demo-mock が起動するので、通常は触らなくてよい。

クライアント送信時、トグル ON のときだけ `x-demo-use-case` ヘッダ (例: `diagnosis`, `goalGeneration`) を付与し、モック側で用途別の固定応答に分岐する (本番 proxy には届かないヘッダ)。

### エラー通知

AI 呼び出しが失敗した場合、`sseFetch.ts` の `aiSseRun` が **throw する前に必ず `showApiErrorToast` を呼ぶ**。呼び出し側 (useEffect 等) で握り潰しても右下にトーストで通知される。`AbortError` (ユーザー中断) と 401 (セッション切れダイアログと衝突) は抑止。

React Query 経由の API エラーは `QueryClient` の `QueryCache.onError` / `MutationCache.onError` で同じく `showApiErrorToast` に流れる (`frontend/src/main.tsx`)。

### SSE パーサ

`frontend/src/lib/ai/sseFetch.ts` の `parseSseBlock` は **Anthropic Messages 形式** と **旧モック形式** の両方を受け付ける互換実装:

- Anthropic Messages: `data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}`
- 旧モック互換: `data: {"text":"..."}`

これにより、本番 proxy / モック / ローカル proxy のいずれでもクライアント側コードを分岐させずに済む。

## 環境変数

主要な設定 (詳細は `.env.local.example` および `frontend/.env.example` を参照):

### Frontend (`frontend/.env.local`)

```env
# Entra ID (Azure AD) — クライアント側の OAuth ログインに使用
VITE_AZURE_CLIENT_ID=
VITE_AZURE_TENANT_ID=
VITE_API_SCOPE=               # 自前 API のカスタムスコープ。Phase 1 では空可

# AI proxy 接続設定
VITE_API_BASE_URL=            # Lambda proxy のベース URL。空なら相対パス /api/... (Vite proxy 経由)
VITE_DEMO_MODE=               # MSW 起動補助フラグ。"true" なら production でも MSW 起動 / それ以外は dev のみ起動
                              # 注: AI 経路の demo / 実 proxy 切替は画面トグル (DemoModeContext) が master
```

### Lambda / Backend 側

API キーは **Lambda の env のみ**が保持し、クライアントには配布しない。クライアントから AI を直接叩く構成は廃止済み。Lambda 側の env (Bedrock 用 IAM / Anthropic キー等) はインフラ側 (`lambda/sam/samconfig.toml`) で管理。
