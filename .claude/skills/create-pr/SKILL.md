---
name: create-pr
description: |
  Pull Requestを作成するスキル。
  MANDATORY TRIGGERS: 「PR作成」「PR作って」「プルリク作成」「pull request作成」などPR作成の要求。
  JIRAチケットURLが提供された場合は、チケット情報を取得してPRに反映する。
---

# Pull Request 作成スキル

コミット済みの変更からPull Requestを作成するワークフロー。

## 前提条件

- 変更がコミット済みであること
- リモートにプッシュ可能な状態であること

## ワークフロー

### Step 1: 現在の状態を確認

```bash
# 並列実行
git status
git diff --stat HEAD~1  # 直近のコミットの変更
git log --oneline -5    # 最近のコミット履歴
git branch --show-current  # 現在のブランチ
```

### Step 2: JIRAチケット情報の取得（URLが提供された場合）

JIRAチケットURLが提供された場合:
1. `getAccessibleAtlassianResources` でcloudIdを取得
2. `getJiraIssue` でチケット詳細を取得
3. チケットのsummaryとdescriptionをPRに反映

### Step 3: ブランチの準備

現在のブランチが `develop` や `main` の場合、featureブランチを作成:

```
ブランチ命名規則: feature/簡潔な説明
例: feature/add_login_functionality
```

```bash
git checkout -b feature/description
```

### Step 4: コミット（未コミットの変更がある場合）

```bash
git add <files>
git commit -m "$(cat <<'EOF'
<prefix>: 変更の要約

詳細な説明（必要に応じて）

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

### Step 5: リモートにプッシュ

```bash
git push -u origin <branch-name>
```

### Step 6: PR作成

```bash
gh pr create --title "<prefix>: タイトル" --body "$(cat <<'EOF'
## チケット or Issueへのリンク
https://kinto-dev.atlassian.net/browse/PAYMENTB-XXXX

## どういう変更をしたのか？
[変更内容の詳細説明]

## なぜこの変更が必要だったのか？
[変更の背景・目的]

## 今回対応しなかったことは何か？
[スコープ外とした項目]

## その他
[追加情報]

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

## PRタイトルのプレフィックス

| プレフィックス | 用途 |
|---------------|------|
| `feat:` | 新機能の追加 |
| `fix:` | バグ修正 |
| `docs:` | ドキュメントのみの変更 |
| `style:` | コードの意味に影響しない変更（フォーマット等） |
| `refactor:` | バグ修正でも機能追加でもないコード変更 |
| `perf:` | パフォーマンス改善 |
| `test:` | テストの追加・修正 |
| `chore:` | ビルドプロセスや補助ツールの変更 |

## プレフィックスの選択基準

変更内容を分析して適切なプレフィックスを選択:

1. **新しいファイル・クラス・機能の追加** → `feat:`
2. **既存の不具合を修正** → `fix:`
3. **READMEやドキュメントのみ** → `docs:`
4. **インデント、空白、セミコロン等** → `style:`
5. **動作を変えずにコード構造を改善** → `refactor:`
6. **処理速度やメモリ効率の改善** → `perf:`
7. **テストコードの追加・修正** → `test:`
8. **CI/CD、ビルド設定、依存関係更新** → `chore:`

## 注意事項

- PRテンプレートは `.github/PULL_REQUEST_TEMPLATE.md` を参照
- JIRAチケットがある場合は必ずリンクを含める
- 変更が複数のカテゴリにまたがる場合は、主要な変更に基づいてプレフィックスを選択
