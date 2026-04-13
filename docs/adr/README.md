# Architecture Decision Records (ADR)

このディレクトリには、KTC Talent Hub の設計判断を記録した ADR を格納する。

## ADR とは

ADR は「なぜその技術的判断をしたのか」を後から追えるようにするための記録。
コードの diff は「何を変えたか」を示すが、ADR は「なぜそう決めたか」を残す。

## 運用ルール

### ファイル命名

```
NNNN-タイトル.md
```

- `NNNN`: 連番（0001 から開始）
- タイトル: ハイフン区切りの短い説明

例: `0001-standalone-mvp-spa-embedding.md`

### いつ書くか

- アーキテクチャに影響する技術選定をしたとき
- 複数の選択肢を比較して判断したとき
- 将来「なぜこうなっている？」と聞かれそうな判断をしたとき

### ステータス

| ステータス | 意味 |
|-----------|------|
| proposed | 提案中（レビュー待ち） |
| accepted | 採用済み |
| deprecated | 廃止（新しいADRで置き換え） |
| superseded | 別のADRに置き換えられた |

## 一覧

| # | タイトル | ステータス |
|---|---------|-----------|
| [0001](0001-api-key-management-proxy.md) | Claude API キー管理 — プロキシサーバー方式の採用 | proposed |

テンプレートは [0000-template.md](0000-template.md) を参照。
