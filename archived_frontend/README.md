## KTC Talent Hub Frontend

このディレクトリが現行の Next.js アプリ本体です。

## Getting Started

開発サーバーはこのディレクトリで起動します。

```bash
npm run dev
```

http://localhost:3000 を開くと画面を確認できます。

## Data Path Notes

このアプリは `../data/.demo-mode.json` に応じて参照データを切り替えます。

- `{"enabled": true}`: reads `data/demo-members`
- `{"enabled": false}`: reads `data/members`

If the selected directory does not exist, the dashboard and team matrix now show a configuration error message instead of a raw `ENOENT` stack trace.

## Main Paths

- `src/app/`: ページと API ルート
- `src/components/`: UI コンポーネント
- `src/lib/`: ファイルアクセス、パーサー、AI 連携
- `../data/`: メンバー情報
- `../talent-management/`: 共有ドキュメントとテンプレート
