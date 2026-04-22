---
name: convert-data
description: |
  data/members/ のMarkdownファイルを frontend/src/mocks/data/ のJSON形式に変換するスキル。
  MANDATORY TRIGGERS: 「データ変換」「convert-data」「data変換」「MD→JSON変換」「シードデータ生成」「データを新方式にして」
---

# データ変換スキル（data/ → frontend/src/mocks/data/）

`data/members/{名前}/` 以下の Markdown ファイルを読み込み、`frontend/src/mocks/data/` のテーブル別 JSON ファイルに変換する。

## 入力（data/ ディレクトリ構造）

```
data/members/
  {名前}/
    profile.md          → members テーブル + projects テーブル
    goals/{period}.md   → goals テーブル
    one-on-one/{月}.md  → one_on_ones テーブル
    reviews/{period}.md → reviews テーブル
```

## 出力（frontend/src/mocks/data/）

```
frontend/src/mocks/data/
  members/{id}_{slug}.json
  projects/{id}.json
  goals/{id}.json
  one-on-ones/{id}.json
  reviews/{id}.json
```

## 変換手順

### Step 1: data/members/ の全メンバーディレクトリを列挙

```bash
ls data/members/
```

### Step 2: 各メンバーについて以下を実行

#### 2a. profile.md → members JSON + projects JSON

profile.md を読み込み、以下のフィールドを抽出する:

**メンバーレコード (`members/{id}_{slug}.json`)**:
- `id`: `mbr_demo_{slug}` 形式で生成（既存IDがあれば維持）
- `slug`: 名前からローマ字slug生成（例: "田中 太郎" → "tanaka-taro"）
- `name`: `- 名前：` フィールド
- `role`: `- 役職：` フィールド
- `team`: `- チーム：` フィールド
- `teamShort`: team から導出（Flutter/KMP/Producer/Manager）
- `joinedAt`: `- 入社年：` フィールド（YYYY-MM形式に正規化）
- `mainProject`: projects の中で最も配分が大きいプロジェクト名
- `rdPct`: R&D プロジェクトの avgPct（なければ 0）
- `skills.technical`: `- 技術スキル：` 以降の内容
- `skills.experience`: `- 業務経験：` 以降の内容
- `skills.strengths`: `- 強み：` 以降の内容
- `skills.challenges`: `- 成長課題：` 以降の内容
- `expectedRole.current`: `- 現在の期待役割：` 以降の内容
- `expectedRole.longTerm`: `- 中長期的なキャリア方向性：` 以降の内容
- `rawMarkdown`: profile.md の全文
- `activePeriod`: 現在の期間（goals/ ディレクトリの最新 period、なければ "2026-h1"）

**プロジェクトレコード (`projects/{id}.json`)**:
`## 担当プロジェクト` セクションから各行をパース:
```
- KINTO Unlimited：4月 60% / 5月 60% / 6月 60%
```
→ `{ id: "proj_{slug}_{safe_name}", memberId: "{member_id}", name, april, may, june, avgPct }`

#### 2b. goals/{period}.md → goals JSON

```json
{
  "id": "goal_{slug}_{period}",
  "memberId": "{member_id}",
  "period": "{period}",
  "memberName": "{name}",
  "rawMarkdown": "ファイル全文"
}
```

period はファイル名から取得（例: `2026-h1.md` → `"2026-h1"`）

#### 2c. one-on-one/{月}.md → one-on-ones JSON

```json
{
  "id": "oo_{slug}_{YYMM}",
  "memberId": "{member_id}",
  "date": "{YYYY-MM}",
  "rawMarkdown": "ファイル全文"
}
```

date はファイル名から取得（例: `2026-04.md` → `"2026-04"`）

#### 2d. reviews/{period}.md → reviews JSON

review の Markdown からメタデータを抽出:
- `period`: ファイルの `# {title}` またはメタ行 `- 対象期間：` から
- `grade`: `- 等級：` の値
- `roleName`: profile の role を流用
- `h2Eval`: `- 下期ミッション評価：` の値（**太字**を除去）
- `annualEval`: `- 年間ミッション評価：` の値
- `promotion`: false（明示的な記述がない限り）
- `feedbackPoints`: `### 評価のポイント` セクションの内容
- `feedbackExpectations`: `### 今後の期待` セクションの内容
- `evaluatorComments[]`: `### {ラベル}` のサブセクションを配列化
- `rawMarkdown`: ファイル全文

```json
{
  "id": "rev_{slug}_{period_short}",
  "memberId": "{member_id}",
  "period": "2025年度下期",
  "grade": "B4",
  "roleName": "エンジニア（Flutter / iOS）",
  "h2Eval": "A",
  "annualEval": "B+",
  "promotion": false,
  "feedbackPoints": "...",
  "feedbackExpectations": "...",
  "evaluatorComments": [
    { "label": "本人コメント", "evaluator": "本人", "content": "..." }
  ],
  "rawMarkdown": "ファイル全文"
}
```

### Step 3: 既存ファイルとのマージ

- 既存の JSON ファイルがある場合は ID を維持する
- 新規メンバーの場合のみ新しい ID を生成
- ai-responses.json と org-docs.json は変更しない

### Step 4: 確認

```bash
ls frontend/src/mocks/data/members/
ls frontend/src/mocks/data/projects/
ls frontend/src/mocks/data/goals/
ls frontend/src/mocks/data/one-on-ones/
ls frontend/src/mocks/data/reviews/
cd frontend && npm run build
```

## slug 変換ルール

日本語名 → ローマ字slug の対応は以下のように決定する:

1. 既存の members JSON から slug を検索（名前が一致するもの）
2. 見つからなければ、ユーザーに slug を確認する
3. slug はケバブケース、ASCII のみ（例: tanaka-taro, suzuki-hanako）

## 注意事項

- `data/members/{名前}/` の `.gitkeep` ファイルはスキップする
- パースに失敗したフィールドは空文字列にする
- rawMarkdown には必ずファイル全文を保持する（UI表示に使用）
- 変換後は `cd frontend && npm run build` でビルド確認すること
