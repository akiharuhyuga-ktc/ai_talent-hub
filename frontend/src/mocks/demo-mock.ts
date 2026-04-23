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
import { dataStore } from "@/lib/data-store";
import { mockDb } from "./db";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function wait(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
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
		pattern: /^\/api\/members\/([^/]+)\/extras$/,
		handler: async (_config, params) => {
			await wait(200);
			return mockDb.getMemberExtras(params[0]);
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
			const members = await dataStore.members.list();
			const matrixMembers = members.map((m) => ({
				memberId: m.id,
				memberName: m.name,
				team: m.teamShort,
				hasGoal: mockDb.hasGoal(m.id, period),
				oneOnOneMonths: mockDb.oneOnOneMonthsFor(m.id),
				hasReview: mockDb.hasReview(m.id),
			}));
			return {
				matrix: { period, members: matrixMembers },
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
		pattern: /^\/api\/members\/([^/]+)\/goals$/,
		handler: async (config, params) => {
			await wait(300);
			const body =
				typeof config.data === "string" ? JSON.parse(config.data) : config.data;
			if (body?.content && body?.period) {
				mockDb.saveGoals(params[0], body.period, body.content);
			}
			return { ok: true };
		},
	},
	{
		method: "post",
		pattern: /^\/api\/members\/([^/]+)\/reviews$/,
		handler: async (config, params) => {
			await wait(300);
			const body =
				typeof config.data === "string" ? JSON.parse(config.data) : config.data;
			if (body?.content && body?.period) {
				mockDb.saveReview(params[0], {
					id: `rev_${params[0]}_${body.period}`,
					memberId: params[0],
					period: body.period,
					grade: "",
					roleName: "",
					h2Eval: "",
					annualEval: "",
					promotion: false,
					feedbackPoints: "",
					feedbackExpectations: "",
					evaluatorComments: [],
					rawMarkdown: body.content,
				});
			}
			return { ok: true };
		},
	},
	{
		method: "post",
		pattern: /^\/api\/members\/[^/]+\/one-on-one\/questions$/,
		handler: async () => {
			await wait(300);
			return { questions: mockDb.getHearingQuestions() };
		},
	},
	{
		method: "post",
		pattern: /^\/api\/members\/([^/]+)\/one-on-one$/,
		handler: async (config, params) => {
			await wait(300);
			const body =
				typeof config.data === "string" ? JSON.parse(config.data) : config.data;
			if (body?.content && body?.yearMonth) {
				mockDb.saveOneOnOne(params[0], {
					id: `oo_${params[0]}_${body.yearMonth.replace("-", "")}`,
					memberId: params[0],
					date: body.yearMonth,
					rawMarkdown: body.content,
				});
			}
			return { ok: true };
		},
	},
	{
		method: "get",
		pattern: /^\/api\/docs$/,
		handler: async () => {
			await wait(200);
			return mockDb.getOrgDocs();
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
		handler: () => sseResponse(mockDb.getAiResponse("diagnosis") as string),
	},
	{
		pattern: /\/api\/members\/[^/]+\/goals\/generate$/,
		handler: () =>
			sseResponse(mockDb.getAiResponse("generatedGoals") as string),
	},
	{
		pattern: /\/api\/members\/[^/]+\/goals\/edit$/,
		handler: () =>
			sseResponse(mockDb.getAiResponse("generatedGoals") as string),
	},
	{
		pattern: /\/api\/members\/[^/]+\/reviews\/draft$/,
		handler: () =>
			sseResponse(mockDb.getAiResponse("evaluationComment") as string),
	},
	{
		pattern: /\/api\/members\/[^/]+\/reviews\/comment$/,
		handler: () =>
			sseResponse(mockDb.getAiResponse("evaluationComment") as string),
	},
	{
		pattern: /\/api\/members\/[^/]+\/one-on-one\/summary$/,
		handler: () =>
			sseResponse(mockDb.getAiResponse("oneOnOneSummary") as string),
	},
	{
		pattern: /\/api\/docs\/policy\/direction$/,
		handler: () =>
			sseResponse(mockDb.getAiResponse("policyDirection") as string),
	},
	{
		pattern: /\/api\/docs\/policy\/draft$/,
		handler: () => sseResponse(mockDb.getAiResponse("policyDraft") as string),
	},
	{
		pattern: /\/api\/docs\/policy\/refine$/,
		handler: () => sseResponse(mockDb.getAiResponse("policyDraft") as string),
	},
	{
		pattern: /\/api\/chat$/,
		handler: () => sseResponse(mockDb.getAiResponse("chatDefault") as string),
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
