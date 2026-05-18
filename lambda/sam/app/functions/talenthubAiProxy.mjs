// talent-hub AI Lambda: bizport JWT auth -> Bedrock streaming proxy
//
// Lambda Function URL の RESPONSE_STREAM (`awslambda.streamifyResponse`) で SSE を返す。
//
// リクエスト:
//   POST /api/ai/invoke   (固定エンドポイント、それ以外の method/path は弾く)
//   X-Bizport-Authorization: Bearer <Entra JWT>   ← CloudFront OAC が標準 Authorization を SigV4 値で上書きするため別 header で運ぶ
//   Content-Type: application/json
//   x-amz-content-sha256: <hex-sha256-of-body>   (CloudFront OAC SigV4 のためクライアント責務)
//   Body: Bedrock InvokeModel に渡す JSON (modelId 以外)
//
// レスポンス:
//   Content-Type: text/event-stream
//   Bedrock invoke_model_with_response_stream の結果を SSE で順次返却。
//   ストリーム途中の Bedrock 例外は SSE `event: error` で送ってから end() する。

import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";

import { validateViaBizport, AuthError } from "../libs/bizportAuth.mjs";

const REGION = process.env.AWS_REGION;
const BEDROCK_MODEL_ID = process.env.BedrockModelId;

const ALLOWED_PATH = "/api/ai/invoke";
const ALLOWED_METHOD = "POST";

// 入力強制の上限値 (コスト暴発と prompt injection 攻撃面の縮小)
const MAX_BODY_BYTES = 32 * 1024;
const MAX_TOKENS_LIMIT = 4096;
const DEFAULT_MAX_TOKENS = 1024;
const ALLOWED_ANTHROPIC_VERSIONS = new Set(["bedrock-2023-05-31"]);

// Bedrock streaming のエラーイベント型 (chunk 以外で来るもの)
const BEDROCK_STREAM_ERROR_EVENTS = [
  "internalServerException",
  "modelStreamErrorException",
  "throttlingException",
  "validationException",
  "modelTimeoutException",
];

const bedrock = new BedrockRuntimeClient({ region: REGION });

function getRequestPath(event) {
  return event.rawPath ?? event.requestContext?.http?.path ?? "";
}

function getRequestMethod(event) {
  return event.requestContext?.http?.method ?? "POST";
}

function getAuthorizationHeader(event) {
  const headers = event.headers ?? {};
  // CloudFront OAC が標準 `Authorization` を SigV4 値で上書きするため、
  // クライアントは `X-Bizport-Authorization` カスタムヘッダで JWT を運ぶ前提。
  return (
    headers["x-bizport-authorization"] ?? headers["X-Bizport-Authorization"] ?? ""
  );
}

function decodeBody(event) {
  const raw = event.body ?? "{}";
  if (event.isBase64Encoded) {
    return Buffer.from(raw, "base64").toString("utf8");
  }
  return raw;
}

async function writeJson(responseStream, statusCode, payload) {
  const stream = awslambda.HttpResponseStream.from(responseStream, {
    statusCode,
    headers: { "Content-Type": "application/json" },
  });
  stream.write(JSON.stringify(payload));
  stream.end();
}

function clampInputBody(body) {
  // body が object でない場合は全部却下 (validation error)
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, message: "body must be a JSON object" };
  }

  // anthropic_version ホワイトリスト
  const ver = body.anthropic_version;
  if (ver && !ALLOWED_ANTHROPIC_VERSIONS.has(ver)) {
    return { ok: false, message: "unsupported anthropic_version" };
  }

  // max_tokens を上限で clamp (省略時はデフォルト値を埋める)
  const requested = Number(body.max_tokens);
  body.max_tokens = Math.min(
    Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_MAX_TOKENS,
    MAX_TOKENS_LIMIT,
  );
  return { ok: true, body };
}

export const handler = awslambda.streamifyResponse(
  async (event, responseStream, _context) => {
    // 0a. method 検証 — POST 以外を 405 で弾く
    const reqMethod = getRequestMethod(event);
    if (reqMethod !== ALLOWED_METHOD) {
      console.warn("method not allowed:", reqMethod);
      await writeJson(responseStream, 405, { error: "method_not_allowed" });
      return;
    }

    // 0b. path 検証 — defense in depth (CloudFront `/api/ai/*` は同 behavior 内で複数 path 通してしまう)
    //     bizport CloudFront の `custom_error_responses` が 404 を `/index.html` (200) に変換するため、
    //     Lambda 側からは 400 Bad Request として返す (400 は変換対象外、viewer に素直に届く)。
    const reqPath = getRequestPath(event);
    if (reqPath !== ALLOWED_PATH) {
      console.warn("path not allowed:", reqPath);
      await writeJson(responseStream, 400, { error: "invalid_path" });
      return;
    }

    // 0c. body サイズ強制
    const rawBody = decodeBody(event);
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      console.warn("payload too large:", Buffer.byteLength(rawBody, "utf8"));
      await writeJson(responseStream, 413, { error: "payload_too_large" });
      return;
    }

    // 1. 認証 (bizport /api/v1/auth/me パススルー検証)
    let user;
    try {
      user = await validateViaBizport(getAuthorizationHeader(event));
    } catch (e) {
      if (e instanceof AuthError) {
        // 内部エラー詳細はログのみ。クライアントには generic に。
        console.warn("auth failed:", e.message);
        await writeJson(responseStream, 401, { error: "unauthorized" });
        return;
      }
      throw e;
    }
    console.info("authenticated:", user.id ?? user.userId ?? "(no id)");

    // 2. body parse + 入力強制
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.warn("invalid request body: malformed JSON");
      await writeJson(responseStream, 400, { error: "invalid_request" });
      return;
    }
    const clamped = clampInputBody(body);
    if (!clamped.ok) {
      console.warn("invalid request body:", clamped.message);
      await writeJson(responseStream, 400, { error: "invalid_request" });
      return;
    }
    body = clamped.body;

    // 3. Bedrock streaming
    let resp;
    try {
      resp = await bedrock.send(
        new InvokeModelWithResponseStreamCommand({
          modelId: BEDROCK_MODEL_ID,
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify(body),
        }),
      );
    } catch (e) {
      console.error("bedrock invoke failed:", e);
      await writeJson(responseStream, 502, { error: "upstream_error" });
      return;
    }

    // 4. SSE で順次返却。ストリーム途中の例外は SSE `event: error` を送ってから終端。
    const sse = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
    try {
      for await (const chunkEvent of resp.body) {
        const bytes = chunkEvent?.chunk?.bytes;
        if (bytes) {
          sse.write(`data: ${Buffer.from(bytes).toString("utf8")}\n\n`);
          continue;
        }
        const errKey = BEDROCK_STREAM_ERROR_EVENTS.find((k) => k in chunkEvent);
        if (errKey) {
          console.error("bedrock stream error:", errKey, chunkEvent[errKey]);
          sse.write(`event: error\ndata: ${JSON.stringify({ type: errKey })}\n\n`);
          return;
        }
      }
      sse.write("event: done\ndata: [DONE]\n\n");
    } catch (e) {
      console.error("stream iteration failed:", e);
      sse.write(`event: error\ndata: ${JSON.stringify({ type: "stream_iteration_failed" })}\n\n`);
    } finally {
      sse.end();
    }
  },
);
