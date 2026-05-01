# Entra ID（Azure AD）App Registration セットアップ

KTC Talent Hub は **Web SPA**（最終形）と **Tauri デスクトップ**（検証用）の 2 形態で提供する。両者で同じ App Registration を共用できるよう、Entra テナント管理者は以下の設定を行う。

## 前提

- Entra テナント管理者権限
- 業務アカウント（職場・学校アカウント）でサインイン可能なテナント

## 1. App Registration の作成

Microsoft Entra 管理センター → アプリの登録 → 「新規登録」。

| 項目 | 値 |
|---|---|
| 名前 | `KTC Talent Hub` |
| サポートされるアカウント | 「**この組織ディレクトリのみに含まれるアカウント**」（シングルテナント） |
| リダイレクト URI | この時点では空欄（後で設定） |

登録後、概要ページの **アプリケーション (クライアント) ID** と **ディレクトリ (テナント) ID** を控える。

## 2. プラットフォーム設定

「認証」→「プラットフォームを追加」で 2 つのプラットフォームを登録する。

### 2-1. Single-page application（Web 提供時に使用）

リダイレクト URI:

- 開発: `http://localhost:5173/auth/callback`
- 本番: `https://<本番ドメイン>/auth/callback`

> 現状の Web 実装は Device Code Flow を使うためこのプラットフォーム設定は必須ではないが、将来 Authorization Code + PKCE に移行する前提で先に登録しておく。

### 2-2. Mobile and desktop applications（Tauri デスクトップで使用）

リダイレクト URI:

- `http://localhost`

ポート番号は付けない。Entra は `http://localhost` を「ホスト一致のみ・任意 port を許可」する特例で扱うため、Tauri 側はランタイムに OS から空き port を取得して使える。

## 3. その他の設定

「認証」ページの下部:

- **パブリッククライアントフローを許可する**: **はい**
  - Tauri loopback と Web 側の Device Code 双方で必要
- **暗黙的な許可とハイブリッド フロー**: いずれもチェック不要

「API のアクセス許可」:

- `Microsoft Graph` の **User.Read**（既定で付与済み）
- 必要に応じて社内 API のスコープを追加（後述）

「公開する API」(将来 backend を建てる時):

- アプリケーション ID URI: `api://<client-id>`
- スコープ追加: `access_as_user`（管理者と利用者の両方の同意で許可）
- これを `.env.local` の `VITE_API_SCOPE` に `api://<client-id>/access_as_user` として設定

## 4. 開発者側の設定

`frontend/.env.local`（`.env.example` をコピー）に以下を設定する:

```
VITE_AZURE_CLIENT_ID=<アプリケーション (クライアント) ID>
VITE_AZURE_TENANT_ID=<ディレクトリ (テナント) ID>
VITE_API_SCOPE=
```

Tauri ビルドでも同じ `.env.local` を読む（Vite が build 時に注入する）。

## 5. 動作モード別の挙動

| モード | フロー | 認可サーバへの到達経路 |
|---|---|---|
| Web（dev: `npm run dev`） | Device Code | Vite proxy `/auth/ms` 経由 |
| Web（本番） | Device Code | バックエンドプロキシ経由（未実装） |
| Tauri（`pnpm tauri dev` / `pnpm tauri build`） | Authorization Code + PKCE | Rust から `login.microsoftonline.com` に直接 |

ビルド時に `TAURI_ENV_PLATFORM` 環境変数の有無で `frontend/src/lib/auth/strategy.ts` が実装を切り替える。

## トラブルシュート

- **`AADSTS9002326`**（cross-origin token 交換）: Web 側で `/token` を叩く際の Origin/Referer が原因。Vite proxy がストリップする設定になっているか確認。
- **`AADSTS50011`**（リダイレクト URI 不一致）: App Registration の URI と実際にアプリが要求した URI が完全一致しているか確認。Tauri loopback では `http://localhost`（末尾 / なし、port なし）と登録すること。
- **ブラウザは戻るがアプリで何も起きない**: Tauri loopback 中はランダム port を OS から借りる。ファイアウォールが loopback を許可しているか確認。
