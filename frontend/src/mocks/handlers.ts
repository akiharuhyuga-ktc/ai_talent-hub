import { delay, HttpResponse, http } from "msw";
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
	http.get("/api/members", async () => {
		await delay(300);
		return HttpResponse.json(mockDb.getMembers());
	}),

	http.post("/api/members", async ({ request }) => {
		await delay(300);
		const body = (await request.json()) as Record<string, unknown>;
		const record = mockDb.addMember(
			body as Parameters<typeof mockDb.addMember>[0],
		);
		return HttpResponse.json(record, { status: 201 });
	}),

	http.get("/api/members/:memberId", async ({ params }) => {
		await delay(200);
		const memberId = params.memberId as string;
		const detail = mockDb.getMemberDetail(memberId);
		if (!detail) {
			return new HttpResponse(null, { status: 404 });
		}
		return HttpResponse.json(detail);
	}),

	http.delete("/api/members/:memberId", async ({ params }) => {
		await delay(200);
		const memberId = params.memberId as string;
		const ok = mockDb.deleteMember(memberId);
		if (!ok) {
			return new HttpResponse(null, { status: 404 });
		}
		return new HttpResponse(null, { status: 204 });
	}),

	http.get("/api/team/matrix", async ({ request }) => {
		await delay(300);
		const url = new URL(request.url);
		const period = url.searchParams.get("period") || "2026-h1";
		return HttpResponse.json({
			matrix: mockDb.buildTeamMatrix(period),
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
		mockDb.saveGoals(memberId, body.period, body.content);
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
		mockDb.saveReview(memberId, {
			id: `rev_${memberId}_${body.period}`,
			memberId,
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
			mockDb.saveOneOnOne(memberId, {
				id: `oo_${memberId}_${body.yearMonth.replace("-", "")}`,
				memberId,
				date: body.yearMonth,
				rawMarkdown: body.content,
			});
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
