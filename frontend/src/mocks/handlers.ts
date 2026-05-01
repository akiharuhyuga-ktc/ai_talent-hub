import { delay, HttpResponse, http } from "msw";
import { dataStore } from "@/lib/data-store";
import { mockDb } from "./db";

// ---------------------------------------------------------------------------
// SSE streaming helper
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
			const payload = JSON.stringify({ text: chunk });
			controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
			await new Promise((r) => setTimeout(r, delayMs));
		},
	});
}

function sseResponse(text: string) {
	return new HttpResponse(createSSEStream(text), {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
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

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const handlers = [
	// -----------------------------------------------------------------------
	// Members & Team
	// -----------------------------------------------------------------------
	// メンバー本体（CRUD）は dataStore 経由で data/v1/members/ に永続化するため
	// MSW ではハンドリングしない。/extras は目標/1on1/評価を dataStore から集約して返す。
	http.get("/api/members/:memberId/extras", async ({ params }) => {
		await delay(200);
		const memberId = params.memberId as string;
		const [goals, oneOnOnes, reviews] = await Promise.all([
			dataStore.goals.listForMember(memberId),
			dataStore.oneOnOnes.listForMember(memberId),
			dataStore.reviews.listForMember(memberId),
		]);
		const goalsByPeriod: Record<string, (typeof goals)[number]> = {};
		for (const g of goals) {
			goalsByPeriod[g.period] = g;
		}
		return HttpResponse.json({ goalsByPeriod, oneOnOnes, reviews });
	}),

	http.get("/api/team/matrix", async ({ request }) => {
		await delay(300);
		const url = new URL(request.url);
		const period = url.searchParams.get("period") || "2026-h1";
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
		return HttpResponse.json({
			matrix: { period, members: matrixMembers },
			availablePeriods: ["2026-h1", "2025-h2"],
		});
	}),

	http.get("/api/health", async () => {
		await delay(100);
		return HttpResponse.json({ status: "ok", version: "dev" });
	}),

	// -----------------------------------------------------------------------
	// 永続化 (保存系)
	// -----------------------------------------------------------------------
	http.post("/api/members/:memberId/goals", async ({ params, request }) => {
		await delay(300);
		const memberId = params.memberId as string;
		const body = (await request.json()) as { content: string; period: string };
		await dataStore.goals.save(memberId, body.period, body.content);
		return HttpResponse.json({ ok: true });
	}),

	http.post("/api/members/:memberId/reviews", async ({ params, request }) => {
		await delay(300);
		const memberId = params.memberId as string;
		const body = (await request.json()) as { content: string; period: string };
		await dataStore.reviews.save(memberId, body.period, body.content);
		return HttpResponse.json({ ok: true });
	}),

	http.post(
		"/api/members/:memberId/one-on-one",
		async ({ params, request }) => {
			await delay(300);
			const memberId = params.memberId as string;
			const body = (await request.json()) as {
				content: string;
				yearMonth: string;
			};
			await dataStore.oneOnOnes.save(memberId, body.yearMonth, body.content);
			return HttpResponse.json({ ok: true });
		},
	),

	// -----------------------------------------------------------------------
	// Docs / Policy
	// -----------------------------------------------------------------------
	http.get("/api/docs", async () => {
		await delay(200);
		return HttpResponse.json(mockDb.getOrgDocs());
	}),

	http.post("/api/docs/policy", async () => {
		await delay(300);
		return HttpResponse.json({ ok: true });
	}),

	// -----------------------------------------------------------------------
	// AI proxy (Bedrock streaming) — 本番では Lambda Function URL に流れる。
	// dev/demo では x-demo-use-case ヘッダで分岐して固定応答をストリーム。
	// -----------------------------------------------------------------------
	http.post("/api/ai/invoke", async ({ request }) => {
		await delay(200);
		const useCase = request.headers.get("x-demo-use-case");
		return sseResponse(lookupDemoText(useCase));
	}),
];
