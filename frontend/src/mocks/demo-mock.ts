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
			const memberId = params[0];
			const [goals, oneOnOnes, reviews] = await Promise.all([
				dataStore.goals.listForMember(memberId),
				dataStore.oneOnOnes.listForMember(memberId),
				dataStore.reviews.listForMember(memberId),
			]);
			const goalsByPeriod: Record<string, (typeof goals)[number]> = {};
			for (const g of goals) {
				goalsByPeriod[g.period] = g;
			}
			return { goalsByPeriod, oneOnOnes, reviews };
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
			const matrixMembers = await Promise.all(
				members.map(async (m) => {
					const [goals, oneOnOnes, reviews] = await Promise.all([
						dataStore.goals.listForMember(m.id),
						dataStore.oneOnOnes.listForMember(m.id),
						dataStore.reviews.listForMember(m.id),
					]);
					return {
						memberId: m.id,
						memberName: m.name,
						team: m.teamShort,
						hasGoal: goals.some((g) => g.period === period),
						oneOnOneMonths: oneOnOnes.map((o) => o.date.split("-")[1]),
						hasReview: reviews.length > 0,
					};
				}),
			);
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
				await dataStore.goals.save(params[0], body.period, body.content);
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
				await dataStore.reviews.save(params[0], body.period, body.content);
			}
			return { ok: true };
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
				await dataStore.oneOnOnes.save(params[0], body.yearMonth, body.content);
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

/**
 * デモモード用: クライアントが付与する `x-demo-use-case` ヘッダから
 * ユースケース別の固定応答を返す。
 */
function lookupDemoText(useCase: string | null): string {
	switch (useCase) {
		case "diagnosis":
			return mockDb.getAiResponse("diagnosis") as string;
		case "goalGeneration":
		case "goalRefinement":
		case "goalEdit":
			return mockDb.getAiResponse("generatedGoals") as string;
		case "evalDraft":
		case "evalComment":
			return mockDb.getAiResponse("evaluationComment") as string;
		case "oneOnOneSummary":
			return mockDb.getAiResponse("oneOnOneSummary") as string;
		case "oneOnOneQuestions":
			return JSON.stringify(mockDb.getHearingQuestions());
		case "policyDirection":
			return mockDb.getAiResponse("policyDirection") as string;
		case "policyDraft":
		case "policyRefine":
			return mockDb.getAiResponse("policyDraft") as string;
		default:
			return mockDb.getAiResponse("chatDefault") as string;
	}
}

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

		// AI proxy (Bedrock streaming) を傍受。本番では Lambda に流れるが、
		// demo モードではユースケース別の固定応答をストリームで返す。
		if (/\/api\/ai\/invoke$/.test(url)) {
			await wait(200);
			const useCase =
				init?.headers instanceof Headers
					? init.headers.get("x-demo-use-case")
					: (getHeaderFromInit(init?.headers, "x-demo-use-case") ?? null);
			return sseResponse(lookupDemoText(useCase));
		}

		return originalFetch(input, init);
	};
}

function getHeaderFromInit(
	headers: HeadersInit | undefined,
	name: string,
): string | null {
	if (!headers) return null;
	const lower = name.toLowerCase();
	if (Array.isArray(headers)) {
		for (const [k, v] of headers) {
			if (k.toLowerCase() === lower) return v;
		}
		return null;
	}
	for (const [k, v] of Object.entries(headers)) {
		if (k.toLowerCase() === lower) return v;
	}
	return null;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function enableDemoMock() {
	setMockResolver(mockResolver);
	installFetchMock();
}
