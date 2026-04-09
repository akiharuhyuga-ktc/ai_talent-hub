#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# .env.local を .env.local.example から自動生成
if [ ! -f "$PROJECT_ROOT/.env.local" ]; then
  cp "$PROJECT_ROOT/.env.local.example" "$PROJECT_ROOT/.env.local"
  echo "[setup] .env.local を作成しました。必要に応じて API キーを設定してください。"
fi
