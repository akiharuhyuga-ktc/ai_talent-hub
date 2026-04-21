/**
 * デモモード用モック — Service Worker 不要
 *
 * Tauri リリースビルド（tauri:// プロトコル）では MSW の Service Worker が
 * 動作しないため、customInstance に直接モックデータを注入する。
 *
 * - Axios 経由の JSON エンドポイント → setMockResolver で直接データを返す
 * - fetch 経由の SSE エンドポイント → window.fetch をラップ
 */
import type { AxiosRequestConfig } from "axios";
import { setMockResolver } from "@/api/custom-instance";
import type { MemberPeriodStatus, TeamPeriodMatrix } from "@/lib/types";
import {
	MOCK_CRITERIA,
	MOCK_DIAGNOSIS_TEXT,
	MOCK_EVALUATION_COMMENT,
	MOCK_GENERATED_GOALS,
	MOCK_GUIDELINES,
	MOCK_HEARING_QUESTIONS,
	MOCK_OO_SUMMARY,
	MOCK_ORG_POLICY,
	MOCK_POLICY_DIRECTION,
	MOCK_POLICY_DRAFT,
	mockMemberDetails,
	mockMembers,
} from "./data";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function wait(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}

function buildTeamMatrix(period: string): TeamPeriodMatrix {
	const members: MemberPeriodStatus[] = mockMembers.map((m) => ({
		memberId: m.folderName,
		memberName: m.name,
		team: m.teamShort,
		hasGoal: Math.random() > 0.3,
		oneOnOneMonths: ["04"],
		hasReview: false,
	}));
	return { period, members };
}

// ---------------------------------------------------------------------------
// Axios mock resolver — JSON endpoints
// ---------------------------------------------------------------------------

type MockRoute = {
	method: string;
	pattern: RegExp;
	handler: (config: AxiosRequestConfig, params: string[]) => Promise<unknown>;
};

const axiosRoutes: MockRoute[] = [
	{
		method: "get",
		pattern: /^\/api\/members$/,
		handler: async () => {
			await wait(300);
			return mockMembers;
		},
	},
	{
		method: "get",
		pattern: /^\/api\/members\/([^/]+)$/,
		handler: async (_config, params) => {
			await wait(200);
			return mockMemberDetails[params[0]] ?? null;
		},
	},
	{
		method: "get",
		pattern: /^\/api\/team\/matrix/,
		handler: async (config) => {
			await wait(300);
			const params = new URLSearchParams(
				typeof config.params === "object" ? config.params : {},
			);
			const period = params.get("period") || "2026-h1";
			return {
				matrix: buildTeamMatrix(period),
				availablePeriods: ["2026-h1", "2025-h2"],
			};
		},
	},
	{
		method: "get",
		pattern: /^\/api\/health$/,
		handler: async () => {
			await wait(100);
			return { status: "ok", version: "demo" };
		},
	},
	{
		method: "post",
		pattern: /^\/api\/members\/[^/]+\/goals$/,
		handler: async () => {
			await wait(300);
			return { ok: true };
		},
	},
	{
		method: "post",
		pattern: /^\/api\/members\/[^/]+\/reviews$/,
		handler: async () => {
			await wait(300);
			return { ok: true };
		},
	},
	{
		method: "post",
		pattern: /^\/api\/members\/[^/]+\/one-on-one\/questions$/,
		handler: async () => {
			await wait(300);
			return { questions: MOCK_HEARING_QUESTIONS };
		},
	},
	{
		method: "post",
		pattern: /^\/api\/members\/[^/]+\/one-on-one$/,
		handler: async () => {
			await wait(300);
			return { ok: true };
		},
	},
	{
		method: "get",
		pattern: /^\/api\/docs$/,
		handler: async () => {
			await wait(200);
			return {
				orgPolicy: MOCK_ORG_POLICY,
				criteria: MOCK_CRITERIA,
				guidelines: MOCK_GUIDELINES,
			};
		},
	},
	{
		method: "post",
		pattern: /^\/api\/docs\/policy$/,
		handler: async () => {
			await wait(300);
			return { ok: true };
		},
	},
];

function mockResolver(config: AxiosRequestConfig): Promise<unknown> | null {
	const method = (config.method || "get").toLowerCase();
	const url = config.url || "";

	for (const route of axiosRoutes) {
		if (route.method !== method) continue;
		const match = url.match(route.pattern);
		if (!match) continue;
		return route.handler(config, match.slice(1));
	}

	return null;
}

// ---------------------------------------------------------------------------
// SSE helper (for fetch-based streaming endpoints)
// ---------------------------------------------------------------------------

function createSSEStream(
	text: string,
	chunkSize = 20,
	delayMs = 50,
): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	let offset = 0;
	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			if (offset >= text.length) {
				controller.enqueue(encoder.encode("data: [DONE]\n\n"));
				controller.close();
				return;
			}
			const chunk = text.slice(offset, offset + chunkSize);
			offset += chunkSize;
			controller.enqueue(
				encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`),
			);
			await new Promise((r) => setTimeout(r, delayMs));
		},
	});
}

function sseResponse(text: string): Response {
	return new Response(createSSEStream(text), {
		status: 200,
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
		},
	});
}

const sseRoutes: Array<{ pattern: RegExp; handler: () => Response }> = [
	{
		pattern: /\/api\/members\/[^/]+\/goals\/diagnosis$/,
		handler: () => sseResponse(MOCK_DIAGNOSIS_TEXT),
	},
	{
		pattern: /\/api\/members\/[^/]+\/goals\/generate$/,
		handler: () => sseResponse(MOCK_GENERATED_GOALS),
	},
	{
		pattern: /\/api\/members\/[^/]+\/goals\/edit$/,
		handler: () => sseResponse(MOCK_GENERATED_GOALS),
	},
	{
		pattern: /\/api\/members\/[^/]+\/reviews\/draft$/,
		handler: () => sseResponse(MOCK_EVALUATION_COMMENT),
	},
	{
		pattern: /\/api\/members\/[^/]+\/reviews\/comment$/,
		handler: () => sseResponse(MOCK_EVALUATION_COMMENT),
	},
	{
		pattern: /\/api\/members\/[^/]+\/one-on-one\/summary$/,
		handler: () => sseResponse(MOCK_OO_SUMMARY),
	},
	{
		pattern: /\/api\/docs\/policy\/direction$/,
		handler: () => sseResponse(MOCK_POLICY_DIRECTION),
	},
	{
		pattern: /\/api\/docs\/policy\/draft$/,
		handler: () => sseResponse(MOCK_POLICY_DRAFT),
	},
	{
		pattern: /\/api\/docs\/policy\/refine$/,
		handler: () => sseResponse(MOCK_POLICY_DRAFT),
	},
	{
		pattern: /\/api\/chat$/,
		handler: () =>
			sseResponse(
				"ご質問ありがとうございます。メンバーの目標設定や評価について、何でもお気軽にご相談ください。具体的な状況を教えていただければ、より適切なアドバイスが可能です。",
			),
	},
];

function installFetchMock() {
	const originalFetch = window.fetch.bind(window);

	window.fetch = async (input, init) => {
		const url =
			typeof input === "string"
				? input
				: input instanceof URL
					? input.href
					: input instanceof Request
						? input.url
						: String(input);

		for (const route of sseRoutes) {
			if (route.pattern.test(url)) {
				await wait(200);
				return route.handler();
			}
		}

		return originalFetch(input, init);
	};
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function enableDemoMock() {
	setMockResolver(mockResolver);
	installFetchMock();
}
