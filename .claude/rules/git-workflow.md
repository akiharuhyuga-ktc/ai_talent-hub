# Git ワークフロー

## ブランチ保護（最重要）

**ファイルを編集・作成する前に、必ず `git branch --show-current` で現在のブランチを確認すること。**
main ブランチにいる場合は、編集を中止し、ユーザーにブランチ作成を提案すること。

## ブランチ運用

main ブランチへの直接プッシュは禁止。PR 経由でマージする。

1. **作業開始時**: feature ブランチを作成
   ```bash
   git checkout -b feature/機能名
   # または fix/バグ名, refactor/対象名, chore/作業名
   ```

2. **作業中**: feature ブランチでコミット

3. **作業完了後**: PR を作成
   ```bash
   git push -u origin feature/機能名
   gh pr create
   ```

## PR作成時のルール

PRタイトルは Conventional Commits プレフィックスを使用する。

- `feat(frontend):` — 新機能
- `fix(frontend):` — バグ修正
- `refactor(frontend):` — リファクタリング
- `docs:` — ドキュメントのみの変更
- `chore:` — 設定変更、CI、その他雑務

```bash
gh pr create --title "feat(frontend): タイトル" --body "$(cat <<'EOF'
## Summary
- 変更内容

## Test plan
- [ ] テスト項目

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

## コミット前チェックリスト（必須）

ユーザーからコミット指示を受けたら、以下を確認すること：

- Frontend変更時: `cd frontend && npm run lint` でエラーがないこと
- ビルド確認: `cd frontend && npm run build` が通ること

**重要:** コミットはユーザーの確認後に行う。Claude は勝手にコミットしない。
