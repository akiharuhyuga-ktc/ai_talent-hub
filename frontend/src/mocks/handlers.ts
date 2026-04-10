import { delay, HttpResponse, http } from "msw";
import type { MemberPeriodStatus, TeamPeriodMatrix } from "@/lib/types";
import { mockMemberDetails, mockMembers } from "./data";

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

export const handlers = [
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
];
