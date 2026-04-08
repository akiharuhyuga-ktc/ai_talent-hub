# KTC Talent Hub

このリポジトリの現行アプリは `frontend/` 配下の Next.js プロジェクトです。アプリの実装本体・依存関係・ビルド設定は `frontend/` に集約しています。

## Getting Started

アプリ起動や依存関係更新は `frontend/` で行います。

```bash
cd frontend
npm install
npm run dev
```

ブラウザで http://localhost:3000 を開くと、`frontend/` のアプリが起動します。

## Repository Layout

- `frontend/`: 現行の Next.js アプリ本体
- `data/`: メンバーデータとデモデータ
- `talent-management/`: テンプレート、ガイドライン、共有ドキュメント
- `docs/`: 設計メモと仕様書
- `old/root-src/`: 廃止済みの旧ルート実装アーカイブ

## Data Layout

- メンバーデータは `data/` 配下に配置します。
- `data/.demo-mode.json` が `{"enabled": true}` の場合は `data/demo-members` を参照します。
- `data/.demo-mode.json` が `{"enabled": false}` の場合は `data/members` を参照します。
- 参照先ディレクトリが存在しない場合、画面と API は設定エラーを返します。

## Notes

- アプリの依存関係を更新したら、`frontend/` 側の lockfile が更新されます。
- アプリの設定変更は `frontend/package.json`、`frontend/tsconfig.json`、`frontend/tailwind.config.ts` などを編集します。
- 画面や API の挙動確認前に、`data/` 配下の構成がモード設定と一致していることを確認してください。
