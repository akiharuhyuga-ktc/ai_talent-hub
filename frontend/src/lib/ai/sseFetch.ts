/**
 * AI proxy (Bedrock streaming Lambda) を叩く SSE クライアント。
 *
 * - エンドポイント: `${VITE_API_BASE_URL}/api/ai/invoke`
 * - 認証: X-Bizport-Authorization (CloudFront OAC が標準 Authorization を SigV4 で
 *   上書きするため別ヘッダ必須)
 * - 必須ヘッダ: x-amz-content-sha256 (POST では client が body の SHA256 を付与必須)
 * - レスポンス: Anthropic Messages streaming format の SSE
 */
import { getApiBase, getBearerAuth } from "@/lib/api/config";
import { showApiErrorToast } from "@/lib/api/errorToast";
import { isDemoMode } from "@/lib/data-store/demo-mode";
import type {
	AnthropicInvokeRequest,
	AnthropicMessage,
	PromptKey,
} from "./types";

const ANTHROPIC_BEDROCK_VERSION = "bedrock-2023-05-31";
const DEFAULT_MAX_TOKENS = 4096;

export interface AiSseRunOpts {
	messages: AnthropicMessage[];
	system?: string;
	maxTokens?: number;
	signal?: AbortSignal;
	/**
	 * デモモード時に demo-mock がユースケース別の固定応答を返すためのヒント。
	 * 画面トグル (DemoModeContext) OFF 時 / 本番ビルドでは付与されない。
	 */
	demoKey?: PromptKey;
	onText?: (cumulative: string) => void;
	onChunk?: (delta: string) => void;
}

export async function aiSseRun(opts: AiSseRunOpts): Promise<string> {
	try {
		return await aiSseRunInner(opts);
	} catch (err) {
		// 呼び出し側 (useEffect 内など) が握り潰しがちなので、ここで必ず通知する
		showApiErrorToast(err);
		throw err;
	}
}

async function aiSseRunInner(opts: AiSseRunOpts): Promise<string> {
	const payload: AnthropicInvokeRequest = {
		anthropic_version: ANTHROPIC_BEDROCK_VERSION,
		max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
		...(opts.system ? { system: opts.system } : {}),
		messages: opts.messages,
	};
	const body = JSON.stringify(payload);

	const headers = await buildHeaders(body, opts.demoKey);
	const url = `${getApiBase()}/api/ai/invoke`;

	const res = await fetch(url, {
		method: "POST",
		headers,
		body,
		signal: opts.signal,
	});

	if (!res.ok) {
		throw new AiProxyError(res.status, await safeReadText(res));
	}
	if (!res.headers.get("content-type")?.includes("text/event-stream")) {
		throw new AiProxyError(res.status, "expected text/event-stream response");
	}
	if (!res.body) {
		throw new AiProxyError(res.status, "response has no body");
	}

	return readSseStream(res.body, opts);
}

async function readSseStream(
	body: ReadableStream<Uint8Array>,
	opts: Pick<AiSseRunOpts, "onText" | "onChunk">,
): Promise<string> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let fullText = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });

		// イベントは空行 (\n\n) 区切り
		const blocks = buffer.split("\n\n");
		buffer = blocks.pop() ?? "";
		for (const block of blocks) {
			const delta = parseSseBlock(block);
			if (!delta) continue;
			fullText += delta;
			opts.onChunk?.(delta);
			opts.onText?.(fullText);
		}
	}

	return fullText;
}

/**
 * SSE ブロックから text delta を抽出する。
 *
 * 受け付ける形式:
 *  - Anthropic Messages: `{"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}`
 *  - 互換 (旧 mock): `{"text":"..."}`
 *  - 終端: `[DONE]` は無視
 */
function parseSseBlock(block: string): string | null {
	const dataLines: string[] = [];
	for (const line of block.split("\n")) {
		if (line.startsWith("data: ")) dataLines.push(line.slice(6));
	}
	if (dataLines.length === 0) return null;
	const payload = dataLines.join("\n").trim();
	if (!payload || payload === "[DONE]") return null;

	try {
		const json = JSON.parse(payload) as Record<string, unknown>;
		if (
			json.type === "content_block_delta" &&
			typeof json.delta === "object" &&
			json.delta !== null
		) {
			const delta = json.delta as { type?: string; text?: string };
			if (delta.type === "text_delta" && typeof delta.text === "string") {
				return delta.text;
			}
		}
		if (typeof json.text === "string") return json.text;
	} catch {
		// パース失敗は無視 (心拍イベント等)
	}
	return null;
}

async function buildHeaders(
	body: string,
	demoKey: PromptKey | undefined,
): Promise<Record<string, string>> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		"x-amz-content-sha256": await sha256Hex(body),
	};
	const auth = await getBearerAuth();
	if (auth) {
		headers["X-Bizport-Authorization"] = auth;
	}
	if (demoKey && isDemoMode()) {
		headers["x-demo-use-case"] = demoKey;
	}
	return headers;
}

async function sha256Hex(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const buf = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

async function safeReadText(res: Response): Promise<string> {
	try {
		return await res.text();
	} catch {
		return "";
	}
}

export class AiProxyError extends Error {
	readonly status: number;
	readonly detail: string;

	constructor(status: number, detail: string) {
		super(`AI proxy error (${status}): ${detail}`);
		this.name = "AiProxyError";
		this.status = status;
		this.detail = detail;
	}
}
