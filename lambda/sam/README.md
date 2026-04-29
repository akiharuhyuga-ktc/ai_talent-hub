# bizport-talenthub-ai (SAM)

タレントハブ向け Bedrock streaming proxy Lambda。

bizport の `/api/me` で Entra JWT を検証 → Bedrock `InvokeModelWithResponseStreamCommand` を SSE で返す Lambda Function URL。

> [!NOTE]
> Lambda Function URL の `RESPONSE_STREAM` (native SSE) は **Node.js ランタイム専用** のため Node.js 24 で実装している ([AWS Lambda response streaming docs](https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html))。

## 構成

```
lambda/sam/
├── template.yml               # SAM テンプレート (FunctionUrlConfig RESPONSE_STREAM, nodejs24.x)
├── samconfig.toml             # 環境別 deploy 設定 + parameter_overrides 集約 (現状 DEV のみ)
├── package.json               # @aws-sdk/client-bedrock-runtime 依存
├── app/
│   ├── functions/
│   │   └── talenthubAiProxy.mjs   # ハンドラ (awslambda.streamifyResponse)
│   └── libs/
│       └── bizportAuth.mjs        # /api/me JWT 検証 (global fetch)
└── tests/
    └── functions/
        └── talenthubAiProxy.test.mjs   # node:test (Node 内蔵テストランナー)
```

## 関連リポジトリ / インフラ前提

| 項目 | 場所 | 役割 |
| --- | --- | --- |
| CloudFront / OAC / IAM 実行ロール / Edge Lambda / WAF (NAT EIP allow) | [`kinto-dev/kinto-infrastructure`](https://github.com/kinto-dev/kinto-infrastructure) `kinto-iac/terraform/v1-platform/common-service/bizport/envs/dev/` | terraform で管理 |
| Lambda 関数本体 + Function URL + Lambda 専用 SG + VpcConfig | 本リポ `lambda/sam/` | SAM で管理 |

Lambda 実行ロール `${env}-bizport-talenthub-ai-lambda-execution-role` は terraform 側 (`pack.lambda.function.talenthub-ai`) で作成済みであることが前提。
IAM 権限 (`bedrock:InvokeModel*`, `ssm:GetParameter`, `secretsmanager:GetSecretValue`, `lambda:InvokeFunction`, ENI 操作) も terraform 側で付与済み。

### VPC 配置と NAT 経路

Lambda は bizport の VPC private subnet に配置する (samconfig.toml の `VpcId` / `SubnetIds`)。Outbound は bizport NAT Gateway を経由 → 固定 EIP 2 件 (1a/1c) から bizport CloudFront `dev-bizport.kinto-mobility.jp/api/me` に到達する。

bizport CloudFront WAF は `default_action = block` + 社内 IP allow 設定のため、上記 NAT EIP を allow rule に登録する terraform 変更を kinto-infrastructure 側で並行適用すること。

## パラメータ運用方針

| パラメータ | 配置 | 備考 |
| --- | --- | --- |
| `Env` / `Stage` / `Sid` / `BizportApiBaseUrl` / `BedrockModelId` | `samconfig.toml` の `[<env>.deploy.parameters].parameter_overrides` に集約 | 環境固有値 |
| `ReleaseVersion` / `ShaShort` | samconfig にデフォルト (`dev` / `local`) を入れ、CI で `--parameter-overrides` 上書き | ビルドメタ |

## デプロイ手順 (dev)

事前: `dev-bizport-cicd` AWS profile が ~/.aws/config に存在。

```bash
# 1. SSO ログイン
aws sso login --profile dev-test

# 2. 依存インストール (Lambda にバンドルする node_modules)
cd lambda/sam
npm install --omit=dev

# 3. SAM build
sam build --use-container       # Node.js 24 ランタイム image を使う

# 4. SAM deploy (DEV)
sam deploy --config-env DEV --profile dev-bizport-cicd

# CI などビルドメタを実値で埋めたい場合は --parameter-overrides で上書き
sam deploy --config-env DEV --profile dev-bizport-cicd --no-confirm-changeset \
  --parameter-overrides \
    "ReleaseVersion=$(git describe --tags --always 2>/dev/null || echo dev)" \
    "ShaShort=$(git rev-parse --short HEAD)"
```

`samconfig.toml` の `confirm_changeset = true` で初回は changeset 確認プロンプトが出る → 内容を見て `y`。

## デプロイ後

`Outputs.TalenthubAiFunctionUrl` で出力される Lambda Function URL のホスト名を取得:

```bash
aws cloudformation describe-stacks \
  --profile dev-bizport-cicd --region ap-northeast-1 \
  --stack-name dev-bizport-talenthub-ai-serverless-resources \
  --query 'Stacks[0].Outputs' --output table
```

そのホスト名 (例: `xxx.lambda-url.ap-northeast-1.on.aws`) を kinto-infrastructure 側の以下に反映 → 2nd `terraform apply`:

- `kinto-iac/terraform/v1-platform/common-service/bizport/envs/dev/locals.tf`
  - `pack.cloudfront.frontend.origin.lambda.domain_name` (コメントアウト解除 + 実値)
  - `pack.cloudfront.frontend.origin.lambda.origin_access_control_id` (OAC ID 実値、コメントアウト解除)
  - `pack.cloudfront.frontend.cache_behaviors` の `/api/ai/*` behavior (コメントアウト解除)

完了後 `https://dev-bizport.kinto-mobility.jp/api/ai/*` 経由で疎通可能。

## Bedrock モデルについて

ap-northeast-1 (Tokyo) は **Global cross-region inference のみ対応** のリージョン。`samconfig.toml` の `BedrockModelId` には Global inference profile ID (`global.anthropic.claude-sonnet-4-6`) を指定している。In-Region / Geo の inference は Tokyo では使えないので、別モデルに切り替えるときも **Global inference profile ID** を指定すること。

## ローカルテスト

```bash
cd lambda/sam
npm install
npm test
```

## 動作確認 (デプロイ後)

CloudFront 紐付け前は Function URL を直接叩いて確認可能 (AWS_IAM 認証なので SigV4 必要):

```bash
# AWS SDK で直接 invoke (auth 無しで 401 になることを確認)
node -e '
import("@aws-sdk/client-lambda").then(async ({ LambdaClient, InvokeWithResponseStreamCommand }) => {
  const c = new LambdaClient({ region: "ap-northeast-1" });
  const r = await c.send(new InvokeWithResponseStreamCommand({
    FunctionName: "dev-bizport-talenthub-ai-function",
    Payload: JSON.stringify({ headers: {}, body: "{}" }),
  }));
  for await (const ev of r.EventStream) {
    if (ev.PayloadChunk) process.stdout.write(Buffer.from(ev.PayloadChunk.Payload).toString());
    if (ev.InvokeComplete) console.error("\\n[done]", ev.InvokeComplete.ErrorCode || "ok");
  }
});'
```

期待: SSE 形式で `{"error":"unauthorized","message":"Authorization header missing"}` が返る。

## 参考

- Jira: [INFRA-10810](https://kinto-dev.atlassian.net/browse/INFRA-10810)
- 参考インフラ構成: kinto-infrastructure の `kinto-iac/terraform/v1-platform/kinto/unlimited/envs/dev` (CloudFront + Lambda Function URL + Edge Lambda OAC SigV4)
- [AWS Lambda response streaming](https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html)
- [Bedrock Sonnet 4.6 model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-4-6.html)
