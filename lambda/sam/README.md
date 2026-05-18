# bizport-talenthub-ai (SAM)

タレントハブ向け Bedrock streaming proxy Lambda。

bizport の `/api/v1/auth/me` で Entra JWT を検証 → Amazon Bedrock `InvokeModelWithResponseStreamCommand` を SSE で返す Lambda Function URL。

> [!NOTE]
> Lambda Function URL の `RESPONSE_STREAM` (native SSE) は **Node.js ランタイム専用** のため Node.js 24 で実装している ([AWS docs](https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html))。

## 目次

- [クライアント呼び出し方](#クライアント呼び出し方)
- [構成](#構成)
- [関連リポジトリ / インフラ前提](#関連リポジトリ--インフラ前提)
- [VPC 配置と NAT 経路](#vpc-配置と-nat-経路)
- [パラメータ運用方針](#パラメータ運用方針)
- [デプロイ手順 (dev)](#デプロイ手順-dev)
- [動作確認](#動作確認)
- [ロールバック](#ロールバック)
- [ローカルテスト](#ローカルテスト)
- [Bedrock モデルについて](#bedrock-モデルについて)
- [依存管理方針](#依存管理方針)
- [参考](#参考)

## クライアント呼び出し方

```
POST https://dev-bizport.kinto-mobility.jp/api/ai/invoke    ← 受付パスは固定
X-Bizport-Authorization: Bearer <Entra JWT>                  ← CloudFront OAC が標準 Authorization を SigV4 で上書きするため別ヘッダで運ぶ
Content-Type: application/json
x-amz-content-sha256: <body の SHA256 hex>                    ← OAC SigV4 のためクライアント責務 (Lambda は unsigned payload 不可)

{ "anthropic_version": "bedrock-2023-05-31", "max_tokens": 1024, "messages": [...] }
```

レスポンス:

| 状況 | HTTP | body |
| --- | --- | --- |
| 認証 OK + Bedrock 成功 | 200 | `Content-Type: text/event-stream` で `data: <chunk>\n\n` を順次返却、最後に `event: done\ndata: [DONE]\n\n` |
| `X-Bizport-Authorization` 欠落 / JWT 無効 | 401 | `{"error":"unauthorized"}` |
| body が JSON 不正 / `anthropic_version` 不正 / `max_tokens` over | 400 | `{"error":"invalid_request"}` |
| body サイズ超過 (>32KB) | 413 | `{"error":"payload_too_large"}` |
| Bedrock 呼び出し失敗 | 502 | `{"error":"upstream_error"}` |
| `/api/ai/invoke` 以外の path | 400 | `{"error":"invalid_path"}` |
| POST 以外の method | 405 | `{"error":"method_not_allowed"}` |
| Bedrock streaming 中の例外 | (200 後) `event: error\ndata: {"type":"<exception name>"}\n\n` | streaming 開始済の場合 |

## 構成

```
lambda/sam/
├── README.md
├── template.yml               # SAM テンプレート (FunctionUrlConfig RESPONSE_STREAM, nodejs24.x, VpcConfig, OAC permission)
├── samconfig.toml             # 環境別 deploy 設定 + parameter_overrides 集約 (DEV のみ)
├── package.json               # @aws-sdk/client-bedrock-runtime 依存 (tilde range)
├── package-lock.json
├── app/
│   ├── functions/
│   │   └── talenthubAiProxy.mjs   # ハンドラ (awslambda.streamifyResponse + 入力強制 + SSE)
│   └── libs/
│       └── bizportAuth.mjs        # bizport /api/v1/auth/me JWT 検証パススルー
└── tests/
    └── functions/
        └── talenthubAiProxy.test.mjs   # node:test (mock.module で AWS SDK / bizportAuth モック)
```

## 関連リポジトリ / インフラ前提

| 項目 | 場所 | 役割 |
| --- | --- | --- |
| CloudFront / OAC / IAM 実行ロール / WAF allow rule | [`kinto-dev/kinto-infrastructure`](https://github.com/kinto-dev/kinto-infrastructure) `kinto-iac/.../bizport/envs/dev/` | terraform で管理 |
| Lambda 関数本体 + Function URL + Lambda 専用 SG + VpcConfig + OAC permission | 本リポ `lambda/sam/` | SAM で管理 |

Lambda 実行ロール `${env}-bizport-talenthub-ai-lambda-execution-role` は terraform 側 (`pack.lambda.function.talenthub-ai`) で作成済みであることが前提。
IAM 権限 (`bedrock:InvokeModel*`, `ssm:GetParameter`, `secretsmanager:GetSecretValue`, ENI 操作) も terraform 側で付与済み。

## VPC 配置と NAT 経路

Lambda は bizport VPC private subnet (1a / 1c) に ENI を作成して動作する。Outbound は bizport 専用 NAT Gateway 経由で固定 EIP 2 件 (`18.180.224.91 / 18.181.52.192`) から bizport CloudFront に到達する。

bizport CloudFront WAF (`default_action = block`) は `allow_from_bizport_lambda` rule で上記 NAT EIP を allow している (terraform 管理)。

## パラメータ運用方針

| パラメータ | 配置 | 備考 |
| --- | --- | --- |
| `Env` / `Stage` / `Sid` / `BizportApiBaseUrl` / `BedrockModelId` / `VpcId` / `SubnetIds` / `CloudFrontDistributionId` | `samconfig.toml` の `[<env>.deploy.parameters].parameter_overrides` に集約 | 環境固有値 |
| `ReleaseVersion` / `ShaShort` | samconfig にデフォルト (`dev` / `local`) を入れ、CI で `--parameter-overrides` 上書き | ビルドメタ |

## デプロイ手順 (dev)

### 0. 事前準備（初回のみ）

```bash
# AWS profile (dev-bizport-cicd) を ~/.aws/config に追加 (まだ無ければ)
cat <<'EOF' >> ~/.aws/config

[profile dev-bizport-cicd]
role_arn = arn:aws:iam::342274811455:role/dev-bizport-cicd-role
source_profile = dev-test
region = ap-northeast-1
EOF
```

ツールの前提:

| ツール | バージョン |
| --- | --- |
| AWS CLI | v2 |
| AWS SAM CLI | latest (`brew install aws-sam-cli` 等) |
| Node.js | 24+ |
| Docker | (`sam build --use-container` を使うとき) |

### 1. SSO ログイン

```bash
aws sso login --profile dev-test
```

### 2. 依存インストール（Lambda にバンドルする node_modules）

```bash
cd lambda/sam
npm ci --omit=dev    # package-lock.json から再現性ある install
```

### 3. SAM build

```bash
sam build --use-container    # Node.js 24 ランタイム image を使うので Docker 必要
```

ローカルに Node.js 24 がある場合は `--use-container` 省略可。

### 4. SAM deploy (DEV)

```bash
sam deploy --config-env DEV --profile dev-bizport-cicd
```

`samconfig.toml` の `confirm_changeset = true` で初回は changeset 確認プロンプトが出る → 内容を確認して `y`。CI で自動化するなら:

```bash
sam deploy --config-env DEV --profile dev-bizport-cicd --no-confirm-changeset \
  --parameter-overrides \
    "ReleaseVersion=$(git describe --tags --always 2>/dev/null || echo dev)" \
    "ShaShort=$(git rev-parse --short HEAD)"
```

### 5. Outputs 確認 (Function URL ホスト名)

```bash
aws cloudformation describe-stacks \
  --profile dev-bizport-cicd --region ap-northeast-1 \
  --stack-name dev-bizport-talenthub-ai-serverless-resources \
  --query 'Stacks[0].Outputs' --output table
```

`TalenthubAiFunctionUrl` の値 (例: `https://xxx.lambda-url.ap-northeast-1.on.aws/`) のホスト名を kinto-infrastructure 側の `pack.cloudfront.frontend.origin.lambda.domain_name` に反映する。

### 6. CloudFront 経路の cache クリア (任意)

deploy で behavior 変更時はキャッシュバイパスのため:

```bash
aws cloudfront create-invalidation \
  --profile dev-bizport-cicd --distribution-id E1ZAZDR0IHAG51 \
  --paths '/api/ai/*'
```

## 動作確認

### CloudFront 経路 (本番ルート、SHA256 ヘッダ要)

```bash
BODY='{}'
HASH=$(printf "%s" "$BODY" | sha256sum | cut -d' ' -f1)

# 認証ヘッダなし → 401
curl -i -m 30 -X POST https://dev-bizport.kinto-mobility.jp/api/ai/invoke \
  -H "Content-Type: application/json" \
  -H "x-amz-content-sha256: $HASH" \
  -d "$BODY"

# 実 JWT 付き
curl -N -m 60 -X POST https://dev-bizport.kinto-mobility.jp/api/ai/invoke \
  -H "X-Bizport-Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -H "x-amz-content-sha256: $HASH" \
  -d '{"anthropic_version":"bedrock-2023-05-31","max_tokens":256,"messages":[{"role":"user","content":"hi"}]}'
```

### Function URL 直叩き (デバッグ、AWS_IAM)

```bash
# Lambda invoke API 経由 (boto3 の invoke_with_response_stream を使用)
AWS_PROFILE=dev-bizport-cicd python3 - <<'PY'
import boto3, json
c = boto3.client("lambda", region_name="ap-northeast-1")
r = c.invoke_with_response_stream(
    FunctionName="dev-bizport-talenthub-ai-function",
    Payload=json.dumps({
        "rawPath": "/api/ai/invoke",
        "requestContext": {"http": {"method": "POST", "path": "/api/ai/invoke"}},
        "headers": {"X-Bizport-Authorization": "Bearer test"},
        "body": "{}"
    }),
)
for ev in r["EventStream"]:
    if "PayloadChunk" in ev:
        print(ev["PayloadChunk"]["Payload"].decode(), end="")
PY
```

### ログ tail

```bash
aws logs tail /aws/lambda/dev-bizport-talenthub-ai-function \
  --profile dev-bizport-cicd --region ap-northeast-1 --since 10m --follow
```

## ロールバック

CloudFormation で前回成功した changeset に巻き戻す:

```bash
# stack 履歴で前回成功時刻を確認
aws cloudformation describe-stack-events \
  --profile dev-bizport-cicd --region ap-northeast-1 \
  --stack-name dev-bizport-talenthub-ai-serverless-resources \
  --query 'StackEvents[?ResourceStatus==`UPDATE_COMPLETE`].[Timestamp,LogicalResourceId]' \
  --output table | head -10

# 前 commit に戻して再 deploy する場合
git checkout <previous-commit> -- lambda/sam
cd lambda/sam && npm ci --omit=dev && sam build && sam deploy --config-env DEV --profile dev-bizport-cicd
git restore --staged lambda/sam && git restore lambda/sam
```

スタックを完全に消したい場合 (注: 関数 URL も消える):

```bash
sam delete --config-env DEV --profile dev-bizport-cicd --no-prompts
```

## ローカルテスト

```bash
cd lambda/sam
npm install
npm test    # node:test (mock.module で AWS SDK / bizportAuth をモック、11 ケース)
```

## Bedrock モデルについて

ap-northeast-1 (Tokyo) は **Global cross-region inference のみ対応** のリージョン。`samconfig.toml` の `BedrockModelId` には Global inference profile ID (`global.anthropic.claude-sonnet-4-6`) を指定している。In-Region / Geo の inference は Tokyo では使えないので、別モデルに切り替えるときも **Global inference profile ID** を指定すること。

## 依存管理方針

`package.json` の依存は **tilde (`~`) レンジ** で patch のみ許容。`@aws-sdk/*` は minor 上げで sub-dependency のメンテナを意図せず引き込むことがあるため、minor / major は人間レビュー必須にしている。

リポ root の `renovate.json` で:

- 公開後 30 日未満の version は PR を作らない (`minimumReleaseAge: "30 days"`、Socket-style age gate)
- `@aws-sdk/*` の minor / major は `automerge: false`
- patch は age gate 通過後に自動マージ可

## 参考

- Jira: [INFRA-10810](https://kinto-dev.atlassian.net/browse/INFRA-10810)
- 関連 PR: [kinto-dev/kinto-infrastructure#9167](https://github.com/kinto-dev/kinto-infrastructure/pull/9167) (terraform)
- 参考インフラ構成: kinto-infrastructure の `kinto-iac/.../kinto/unlimited/envs/dev` (CloudFront + Lambda Function URL + OAC SigV4)
- [AWS Lambda response streaming](https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html)
- [Restrict access to a Lambda function URL origin (CloudFront OAC)](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-lambda.html)
- [Bedrock Sonnet 4.6 model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-4-6.html)
