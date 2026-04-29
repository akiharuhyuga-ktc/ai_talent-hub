// talent-hub AI Lambda: bizport JWT auth -> Bedrock streaming proxy
//
// Lambda Function URL の RESPONSE_STREAM (`awslambda.streamifyResponse`) で SSE を返す。
//
// リクエスト:
//   POST /api/ai/<path>
//   Authorization: Bearer <Entra JWT>
//   Content-Type: application/json
//   Body: Bedrock InvokeModel に渡す JSON (modelId 以外)
//
// レスポンス:
//   Content-Type: text/event-stream
//   Bedrock invoke_model_with_response_stream の結果を SSE で順次返却。

import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";

import { verifyJwt, AuthError } from "../libs/bizportAuth.mjs";

const REGION = process.env.Region;
const BEDROCK_MODEL_ID = process.env.BedrockModelId;

const bedrock = new BedrockRuntimeClient({ region: REGION });

function getAuthorizationHeader(event) {
  const headers = event.headers ?? {};
  return headers.authorization ?? headers.Authorization ?? "";
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

export const handler = awslambda.streamifyResponse(
  async (event, responseStream, _context) => {
    // 1. 認証
    let user;
    try {
      user = await verifyJwt(getAuthorizationHeader(event));
    } catch (e) {
      if (e instanceof AuthError) {
        console.warn("auth failed:", e.message);
        await writeJson(responseStream, 401, {
          error: "unauthorized",
          message: e.message,
        });
        return;
      }
      throw e;
    }
    console.info("authenticated:", user.id ?? user.userId ?? "(no id)");

    // 2. body parse
    let body;
    try {
      body = JSON.parse(decodeBody(event));
    } catch (e) {
      console.warn("invalid request body:", e.message);
      await writeJson(responseStream, 400, {
        error: "invalid_request",
        message: "body is not valid JSON",
      });
      return;
    }

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
      await writeJson(responseStream, 502, {
        error: "bedrock_error",
        message: e.message,
      });
      return;
    }

    // 4. SSE で順次返却
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
        if (!bytes) continue;
        const text = Buffer.from(bytes).toString("utf8");
        sse.write(`data: ${text}\n\n`);
      }
      sse.write("event: done\ndata: [DONE]\n\n");
    } finally {
      sse.end();
    }
  },
);
