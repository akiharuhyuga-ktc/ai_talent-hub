/**
 * デモモード用モック — Service Worker 不要
 *
 * Tauri リリースビルド（tauri:// プロトコル）では MSW の Service Worker が
 * 動作しないため、customInstance に直接モックデータを注入する。
 *
 * AI 経路 (`/api/ai/invoke`) は本モジュールでは intercept しない。常に実 Lambda へ
 * 通信する方針（Tauri 本番は plugin-http 経由、dev は Vite proxy 経由）。
 */
import type { AxiosRequestConfig } from "axios";
import { setMockResolver } from "@/api/custom-instance";
import { dataStore } from "@/lib/data-store";
import { readOrgDocs, writeOrgPolicy } from "@/lib/data-store/tauri-fs";

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
		// Tauri本番: $RESOURCE/talent-management/shared/ を読む（$APPDATA 優先）
		// ?year= / ?strict= クエリパラメータを tauri-fs.readOrgDocs() に転送する
		method: "get",
		pattern: /^\/api\/docs(\?|$)/,
		handler: async (config) => {
			await wait(200);
			const rawUrl = config.url || "";
			const qIdx = rawUrl.indexOf("?");
			const sp = new URLSearchParams(qIdx >= 0 ? rawUrl.slice(qIdx + 1) : "");
			const yearParam = sp.get("year");
			const strictParam = sp.get("strict");
			const opts: { year?: number; strict?: boolean } = {};
			if (yearParam) opts.year = Number(yearParam);
			if (strictParam === "true") opts.strict = true;
			return await readOrgDocs(opts);
		},
	},
	{
		method: "post",
		pattern: /^\/api\/docs\/policy$/,
		handler: async (config) => {
			await wait(300);
			const body =
				typeof config.data === "string" ? JSON.parse(config.data) : config.data;
			const { year, content, overwrite } = body ?? {};
			if (!year || content === undefined) return { ok: false };
			const result = await writeOrgPolicy(
				Number(year),
				String(content),
				Boolean(overwrite),
			);
			if (result.conflict) {
				const err = new Error(
					`年度 ${year} の方針はすでに存在します`,
				) as Error & { response?: { status: number; data: unknown } };
				err.response = {
					status: 409,
					data: { error: "conflict", message: err.message },
				};
				throw err;
			}
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
// Entry point
// ---------------------------------------------------------------------------

export function enableDemoMock() {
	setMockResolver(mockResolver);
}
