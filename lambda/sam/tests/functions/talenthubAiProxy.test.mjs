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
const auth = await import("../../app/libs/bizportAuth.mjs");

test("returns 401 when Authorization header missing", async () => {
  const stream = new FakeStream();
  await handler({ headers: {}, body: "{}" }, stream);
  assert.equal(stream.statusCode, 401);
  assert.match(stream.body(), /unauthorized/);
  assert.equal(stream.ended, true);
});

test("returns 400 when body is not JSON", async (t) => {
  const stream = new FakeStream();
  // verifyJwt をモックして通す
  t.mock.method(auth, "verifyJwt", async () => ({ id: "u1" }));
  await handler({ headers: { Authorization: "Bearer ok" }, body: "not-json" }, stream);
  assert.equal(stream.statusCode, 400);
  assert.match(stream.body(), /invalid_request/);
});
