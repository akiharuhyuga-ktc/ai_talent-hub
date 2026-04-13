import { delay, HttpResponse, http } from "msw";
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
// Team matrix builder
// ---------------------------------------------------------------------------

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
// Handlers
// ---------------------------------------------------------------------------

export const handlers = [
	// -----------------------------------------------------------------------
	// Existing: Members & Team
	// -----------------------------------------------------------------------
	http.get("/api/members", async () => {
		await delay(300);
		return HttpResponse.json(mockMembers);
	}),

	http.get("/api/members/:name", async ({ params }) => {
		await delay(200);
		const name = params.name as string;
		const detail = mockMemberDetails[name];
		if (!detail) {
			return new HttpResponse(null, { status: 404 });
		}
		return HttpResponse.json(detail);
	}),

	http.get("/api/team/matrix", async ({ request }) => {
		await delay(300);
		const url = new URL(request.url);
		const period = url.searchParams.get("period") || "2026-h1";
		const matrix = buildTeamMatrix(period);
		return HttpResponse.json({
			matrix,
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
	http.post("/api/members/:name/goals/diagnosis", async () => {
		await delay(200);
		return sseResponse(MOCK_DIAGNOSIS_TEXT);
	}),

	http.post("/api/members/:name/goals/generate", async () => {
		await delay(200);
		return sseResponse(MOCK_GENERATED_GOALS);
	}),

	http.post("/api/members/:name/goals", async () => {
		await delay(300);
		return HttpResponse.json({ ok: true });
	}),

	http.post("/api/members/:name/goals/edit", async () => {
		await delay(200);
		return sseResponse(MOCK_GENERATED_GOALS);
	}),

	// -----------------------------------------------------------------------
	// Evaluation Wizard
	// -----------------------------------------------------------------------
	http.post("/api/members/:name/reviews/draft", async () => {
		await delay(200);
		return sseResponse(MOCK_EVALUATION_COMMENT);
	}),

	http.post("/api/members/:name/reviews/comment", async () => {
		await delay(200);
		return sseResponse(MOCK_EVALUATION_COMMENT);
	}),

	http.post("/api/members/:name/reviews", async () => {
		await delay(300);
		return HttpResponse.json({ ok: true });
	}),

	// -----------------------------------------------------------------------
	// 1on1 Wizard
	// -----------------------------------------------------------------------
	http.post("/api/members/:name/one-on-one/questions", async () => {
		await delay(300);
		return HttpResponse.json({ questions: MOCK_HEARING_QUESTIONS });
	}),

	http.post("/api/members/:name/one-on-one/summary", async () => {
		await delay(200);
		return sseResponse(MOCK_OO_SUMMARY);
	}),

	http.post("/api/members/:name/one-on-one", async () => {
		await delay(300);
		return HttpResponse.json({ ok: true });
	}),

	// -----------------------------------------------------------------------
	// Docs / Policy
	// -----------------------------------------------------------------------
	http.get("/api/docs", async () => {
		await delay(200);
		return HttpResponse.json({
			orgPolicy: MOCK_ORG_POLICY,
			criteria: MOCK_CRITERIA,
			guidelines: MOCK_GUIDELINES,
		});
	}),

	http.post("/api/docs/policy/direction", async () => {
		await delay(200);
		return sseResponse(MOCK_POLICY_DIRECTION);
	}),

	http.post("/api/docs/policy/draft", async () => {
		await delay(200);
		return sseResponse(MOCK_POLICY_DRAFT);
	}),

	http.post("/api/docs/policy/refine", async () => {
		await delay(200);
		return sseResponse(MOCK_POLICY_DRAFT);
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
		return sseResponse(
			"ご質問ありがとうございます。メンバーの目標設定や評価について、何でもお気軽にご相談ください。具体的な状況を教えていただければ、より適切なアドバイスが可能です。",
		);
	}),
];
