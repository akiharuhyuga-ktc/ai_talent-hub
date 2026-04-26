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
	// Goal Wizard
	// -----------------------------------------------------------------------
	http.post("/api/members/:memberId/goals/diagnosis", async () => {
		await delay(200);
		return sseResponse(mockDb.getAiResponse("diagnosis") as string);
	}),

	http.post("/api/members/:memberId/goals/generate", async () => {
		await delay(200);
		return sseResponse(mockDb.getAiResponse("generatedGoals") as string);
	}),

	http.post("/api/members/:memberId/goals", async ({ params, request }) => {
		await delay(300);
		const memberId = params.memberId as string;
		const body = (await request.json()) as { content: string; period: string };
		await dataStore.goals.save(memberId, body.period, body.content);
		return HttpResponse.json({ ok: true });
	}),

	http.post("/api/members/:memberId/goals/edit", async () => {
		await delay(200);
		return sseResponse(mockDb.getAiResponse("generatedGoals") as string);
	}),

	// -----------------------------------------------------------------------
	// Evaluation Wizard
	// -----------------------------------------------------------------------
	http.post("/api/members/:memberId/reviews/draft", async () => {
		await delay(200);
		return sseResponse(mockDb.getAiResponse("evaluationComment") as string);
	}),

	http.post("/api/members/:memberId/reviews/comment", async () => {
		await delay(200);
		return sseResponse(mockDb.getAiResponse("evaluationComment") as string);
	}),

	http.post("/api/members/:memberId/reviews", async ({ params, request }) => {
		await delay(300);
		const memberId = params.memberId as string;
		const body = (await request.json()) as { content: string; period: string };
		await dataStore.reviews.save(memberId, body.period, body.content);
		return HttpResponse.json({ ok: true });
	}),

	// -----------------------------------------------------------------------
	// 1on1 Wizard
	// -----------------------------------------------------------------------
	http.post("/api/members/:memberId/one-on-one/questions", async () => {
		await delay(300);
		return HttpResponse.json({
			questions: mockDb.getHearingQuestions(),
		});
	}),

	http.post("/api/members/:memberId/one-on-one/summary", async () => {
		await delay(200);
		return sseResponse(mockDb.getAiResponse("oneOnOneSummary") as string);
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

	http.post("/api/docs/policy/direction", async () => {
		await delay(200);
		return sseResponse(mockDb.getAiResponse("policyDirection") as string);
	}),

	http.post("/api/docs/policy/draft", async () => {
		await delay(200);
		return sseResponse(mockDb.getAiResponse("policyDraft") as string);
	}),

	http.post("/api/docs/policy/refine", async () => {
		await delay(200);
		return sseResponse(mockDb.getAiResponse("policyDraft") as string);
	}),

	http.post("/api/docs/policy", async () => {
		await delay(300);
		return HttpResponse.json({ ok: true });
	}),

	// -----------------------------------------------------------------------
	// Chat
	// -----------------------------------------------------------------------
	http.post("/api/chat", async () => {
		await delay(200);
		return sseResponse(mockDb.getAiResponse("chatDefault") as string);
	}),
];
