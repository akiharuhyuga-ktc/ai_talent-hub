import { test, mock } from "node:test";
import assert from "node:assert/strict";

// streamifyResponse / HttpResponseStream を Node.js test 環境向けに最小限スタブ
class FakeStream {
  constructor() {
    this.statusCode = null;
    this.headers = {};
    this.chunks = [];
    this.ended = false;
  }
  write(chunk) {
    this.chunks.push(chunk);
  }
  end() {
    this.ended = true;
  }
  body() {
    return this.chunks.join("");
  }
}

globalThis.awslambda = {
  streamifyResponse: (fn) => fn,
  HttpResponseStream: {
    from(stream, meta) {
      stream.statusCode = meta.statusCode;
      stream.headers = meta.headers;
      return stream;
    },
  },
};

process.env.AWS_REGION = "ap-northeast-1";
process.env.BedrockModelId = "global.anthropic.claude-sonnet-4-6";
process.env.BizportApiBaseUrl = "https://example.invalid";

class AuthError extends Error {
  constructor(m) {
    super(m);
    this.name = "AuthError";
  }
}

// `bizportAuth` モジュール全体をモック (mock.module は ESM の named export を差し替えられる)
let validateImpl = async () => ({ id: "test-user" });
mock.module("../../app/libs/bizportAuth.mjs", {
  namedExports: {
    AuthError,
    validateViaBizport: (...args) => validateImpl(...args),
  },
});

// `@aws-sdk/client-bedrock-runtime` をモックして Bedrock 呼び出しを差し替えられるようにする
let bedrockSendImpl = async () => ({ body: (async function* () {})() });
mock.module("@aws-sdk/client-bedrock-runtime", {
  namedExports: {
    BedrockRuntimeClient: class {
      send(...args) {
        return bedrockSendImpl(...args);
      }
    },
    InvokeModelWithResponseStreamCommand: class {
      constructor(input) {
        this.input = input;
      }
    },
  },
});

const { handler } = await import("../../app/functions/talenthubAiProxy.mjs");

function eventWith({
  method = "POST",
  path = "/api/ai/invoke",
  headers = { "x-bizport-authorization": "Bearer ok" },
  body = JSON.stringify({ anthropic_version: "bedrock-2023-05-31", max_tokens: 100, messages: [] }),
} = {}) {
  return { rawPath: path, requestContext: { http: { method, path } }, headers, body };
}

// ---- early gates --------------------------------------------------------

test("405 when method is not POST", async () => {
  const stream = new FakeStream();
  await handler(eventWith({ method: "GET" }), stream);
  assert.equal(stream.statusCode, 405);
  assert.match(stream.body(), /method_not_allowed/);
});

test("400 when path is not /api/ai/invoke", async () => {
  const stream = new FakeStream();
  await handler(eventWith({ path: "/api/ai/other" }), stream);
  assert.equal(stream.statusCode, 400);
  assert.match(stream.body(), /invalid_path/);
});

test("413 when body exceeds 32KB", async () => {
  const stream = new FakeStream();
  const huge = "x".repeat(33 * 1024);
  await handler(eventWith({ body: huge }), stream);
  assert.equal(stream.statusCode, 413);
  assert.match(stream.body(), /payload_too_large/);
});

// ---- auth ---------------------------------------------------------------

test("401 when X-Bizport-Authorization header missing", async () => {
  const stream = new FakeStream();
  validateImpl = async () => {
    throw new AuthError("Authorization header missing");
  };
  await handler(eventWith({ headers: {} }), stream);
  validateImpl = async () => ({ id: "test-user" });
  assert.equal(stream.statusCode, 401);
  // generic message のみ。内部詳細は出さない。
  assert.match(stream.body(), /^\{"error":"unauthorized"\}$/);
});

test("standard Authorization is ignored, only X-Bizport-Authorization is read", async () => {
  const stream = new FakeStream();
  // Lambda は X-Bizport-Authorization を読む。標準 Authorization があっても使わない =
  // validateViaBizport には空文字列が渡って AuthError を投げる動作をシミュレート。
  validateImpl = async (h) => {
    if (!h) throw new AuthError("Authorization header missing");
    return { id: "test-user" };
  };
  await handler(eventWith({ headers: { Authorization: "Bearer ignored" } }), stream);
  validateImpl = async () => ({ id: "test-user" });
  assert.equal(stream.statusCode, 401);
});

// ---- input validation ---------------------------------------------------

test("400 when body is not valid JSON", async () => {
  const stream = new FakeStream();
  await handler(eventWith({ body: "not-json" }), stream);
  assert.equal(stream.statusCode, 400);
  assert.match(stream.body(), /invalid_request/);
});

test("400 when anthropic_version is not allowed", async () => {
  const stream = new FakeStream();
  await handler(eventWith({ body: JSON.stringify({ anthropic_version: "evil-version" }) }), stream);
  assert.equal(stream.statusCode, 400);
});

test("max_tokens is clamped to upper limit", async () => {
  const stream = new FakeStream();
  let observed;
  bedrockSendImpl = async (cmd) => {
    observed = JSON.parse(cmd.input.body);
    return { body: (async function* () { yield { chunk: { bytes: Buffer.from('{"ok":1}') } }; })() };
  };
  await handler(eventWith({ body: JSON.stringify({ anthropic_version: "bedrock-2023-05-31", max_tokens: 999999 }) }), stream);
  assert.equal(observed.max_tokens, 4096);
  assert.equal(stream.statusCode, 200);
});

// ---- bedrock streaming --------------------------------------------------

test("200 SSE streaming from bedrock chunk", async () => {
  const stream = new FakeStream();
  bedrockSendImpl = async () => ({
    body: (async function* () {
      yield { chunk: { bytes: Buffer.from('{"delta":"a"}') } };
      yield { chunk: { bytes: Buffer.from('{"delta":"b"}') } };
    })(),
  });
  await handler(eventWith(), stream);
  assert.equal(stream.statusCode, 200);
  assert.equal(stream.headers["Content-Type"], "text/event-stream");
  assert.match(stream.body(), /data: \{"delta":"a"\}/);
  assert.match(stream.body(), /data: \{"delta":"b"\}/);
  assert.match(stream.body(), /event: done\ndata: \[DONE\]/);
});

test("502 upstream_error when bedrock invoke throws (not generic SDK message)", async () => {
  const stream = new FakeStream();
  bedrockSendImpl = async () => {
    throw new Error("bedrock unavailable internal info");
  };
  await handler(eventWith(), stream);
  assert.equal(stream.statusCode, 502);
  // 内部 e.message は漏らさない (generic な error code のみ)
  assert.match(stream.body(), /^\{"error":"upstream_error"\}$/);
});

test("SSE event:error when bedrock stream emits throttlingException", async () => {
  const stream = new FakeStream();
  bedrockSendImpl = async () => ({
    body: (async function* () {
      yield { chunk: { bytes: Buffer.from('{"delta":"a"}') } };
      yield { throttlingException: { message: "Too many" } };
    })(),
  });
  await handler(eventWith(), stream);
  assert.equal(stream.statusCode, 200);
  assert.match(stream.body(), /data: \{"delta":"a"\}/);
  assert.match(stream.body(), /event: error\ndata: \{"type":"throttlingException"\}/);
  // done は来ない (error で抜けたため)
  assert.doesNotMatch(stream.body(), /\[DONE\]/);
});
