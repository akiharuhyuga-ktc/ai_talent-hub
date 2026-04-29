import { test } from "node:test";
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

process.env.Region = "ap-northeast-1";
process.env.BedrockModelId = "global.anthropic.claude-sonnet-4-6";
process.env.BizportApiBaseUrl = "https://example.invalid";

const { handler } = await import("../../app/functions/talenthubAiProxy.mjs");

function eventWith({ path = "/api/ai/invoke", headers = {}, body = "{}" } = {}) {
  return { rawPath: path, headers, body };
}

test("returns 400 when path is not /api/ai/invoke", async () => {
  const stream = new FakeStream();
  await handler(eventWith({ path: "/api/ai/something" }), stream);
  assert.equal(stream.statusCode, 400);
  assert.match(stream.body(), /invalid_path/);
});

test("returns 401 when X-Bizport-Authorization header missing", async () => {
  const stream = new FakeStream();
  await handler(eventWith(), stream);
  assert.equal(stream.statusCode, 401);
  assert.match(stream.body(), /unauthorized/);
  assert.equal(stream.ended, true);
});

test("standard Authorization header is ignored (must use X-Bizport-Authorization)", async () => {
  const stream = new FakeStream();
  // 標準 Authorization は CloudFront OAC で消されるため Lambda 側でも無視する
  await handler(eventWith({ headers: { Authorization: "Bearer should-be-ignored" } }), stream);
  assert.equal(stream.statusCode, 401);
  assert.match(stream.body(), /Authorization header missing/);
});

// NOTE: 400 (invalid body) ケースは認証成功後にしか到達しないため、verifyJwt を mock 必須。
// node:test は ESM named export を redefine できないので、本ユニットテストでは省略する。
// 実機検証で確認する。
