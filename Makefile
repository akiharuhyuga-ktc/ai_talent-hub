.PHONY: help setup dev dev-build down logs \
       install gen gen-api lint lint-api format typecheck test test-coverage build \
       clean clean-volumes clean-all

# ============================================================================
# Help
# ============================================================================

help: ## コマンド一覧を表示
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help

# ============================================================================
# Setup
# ============================================================================

setup: ## 初回セットアップ（.env.local 作成 + 依存インストール）
	@bash scripts/setup.sh
	@cd frontend && pnpm install

install: ## frontend の依存パッケージをインストール
	@cd frontend && pnpm install

# ============================================================================
# Development
# ============================================================================

dev: setup ## Docker Compose で開発環境を起動
	docker compose up

dev-build: setup ## Docker イメージを再ビルドして起動
	docker compose up --build

down: ## Docker Compose を停止
	docker compose down

logs: ## Docker Compose のログを表示（follow）
	docker compose logs -f

# ============================================================================
# Code Generation
# ============================================================================

gen: gen-api ## すべてのコード自動生成を実行

gen-api: gen-api-frontend gen-api-backend ## OpenAPI スペックからクライアント・サーバーコードを生成

gen-api-frontend: ## OpenAPI → フロントエンド API クライアント生成（orval）
	@cd frontend && pnpm gen:api

gen-api-backend: ## OpenAPI → バックエンド サーバーインターフェース生成（oapi-codegen）
	@cd backend && oapi-codegen -config oapi-codegen.yaml ../openapi/openapi.json

# ============================================================================
# Quality
# ============================================================================

lint: ## frontend の Lint を実行（Biome）
	@cd frontend && pnpm lint

lint-api: ## OpenAPI スペックの Lint を実行（Redocly）
	@cd frontend && pnpm lint:api

format: ## frontend のコードフォーマット（Biome）
	@cd frontend && pnpm format

typecheck: ## TypeScript の型チェック
	@cd frontend && pnpm typecheck

test: ## テスト実行
	@cd frontend && pnpm test:run

test-coverage: ## カバレッジ付きテスト実行
	@cd frontend && pnpm test:coverage

build: ## frontend のプロダクションビルド
	@cd frontend && pnpm build

quality: lint typecheck test ## Lint + 型チェック + テストをまとめて実行

# ============================================================================
# Clean
# ============================================================================

clean: ## frontend のビルド成果物を削除
	@rm -rf frontend/dist frontend/node_modules/.tmp

clean-volumes: ## Docker の named volumes を削除
	docker compose down -v

clean-all: clean clean-volumes ## ビルド成果物 + Docker volumes をすべて削除
	@rm -rf frontend/node_modules
