/**
 * MockDatabase — テーブル別JSONファイルからデータを組み立てる in-memory ストア
 *
 * ファイル構成は MySQL テーブルと1:1対応:
 *   data/members/{id}_{slug}.json    → members テーブル
 *   data/projects/{id}.json          → project_allocations テーブル
 *   data/goals/{id}.json             → goals テーブル
 *   data/one-on-ones/{id}.json       → one_on_ones テーブル
 *   data/reviews/{id}.json           → reviews テーブル
 *
 * 永続化: localStorage にオーバーレイとして保存。
 *   seed data (JSON files) + localStorage overlay = 実行時データ
 *
 * 第一弾: MSW / demo-mock がこのクラス経由でデータを返す
 * 第二弾: Go backend → MySQL に置き換わり、このファイルは不要になる
 */

import type { MemberRecord, ProjectRecord } from "@/api/generated/types";
import type {
	GoalsData,
	MemberDetail,
	MemberPeriodStatus,
	MemberSummary,
	OneOnOneRecord,
	ReviewData,
	TeamPeriodMatrix,
} from "@/lib/types";

import aiResponsesJson from "./data/ai-responses.json";
import orgDocsJson from "./data/org-docs.json";

// ---------------------------------------------------------------------------
// import.meta.glob でテーブル別ディレクトリから seed data を読み込む
// ---------------------------------------------------------------------------

const memberModules = import.meta.glob<MemberRecord>("./data/members/*.json", {
	eager: true,
	import: "default",
});
const projectModules = import.meta.glob<ProjectRecord>(
	"./data/projects/*.json",
	{ eager: true, import: "default" },
);
const goalModules = import.meta.glob<GoalsData>("./data/goals/*.json", {
	eager: true,
	import: "default",
});
const oneOnOneModules = import.meta.glob<OneOnOneRecord>(
	"./data/one-on-ones/*.json",
	{ eager: true, import: "default" },
);
const reviewModules = import.meta.glob<ReviewData>("./data/reviews/*.json", {
	eager: true,
	import: "default",
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function vals<T>(modules: Record<string, T>): T[] {
	return Object.values(modules);
}

function deepClone<T>(obj: T): T {
	return JSON.parse(JSON.stringify(obj));
}

const STORAGE_KEY = "mockDb";

function generateId(prefix: string): string {
	const ts = Date.now().toString(36);
	const rand = Math.random().toString(36).slice(2, 8);
	return `${prefix}_${ts}${rand}`;
}

function toSlug(name: string): string {
	return (
		name
			.normalize("NFKC")
			.replace(/\s+/g, "-")
			.replace(/[^\w-]/g, "")
			.toLowerCase() || `member-${Date.now()}`
	);
}

// ---------------------------------------------------------------------------
// MockDatabase
// ---------------------------------------------------------------------------

interface StorageSnapshot {
	members: MemberRecord[];
	projects: ProjectRecord[];
	goals: GoalsData[];
	oneOnOnes: OneOnOneRecord[];
	reviews: ReviewData[];
}

class MockDatabase {
	private memberRecords: MemberRecord[];
	private projectRecords: ProjectRecord[];
	private goalRecords: GoalsData[];
	private oneOnOneRecords: OneOnOneRecord[];
	private reviewRecords: ReviewData[];
	private aiResponses: typeof aiResponsesJson;
	private orgDocs: typeof orgDocsJson;

	constructor() {
		const saved = this.loadFromStorage();
		if (saved) {
			this.memberRecords = saved.members;
			this.projectRecords = saved.projects;
			this.goalRecords = saved.goals;
			this.oneOnOneRecords = saved.oneOnOnes;
			this.reviewRecords = saved.reviews;
		} else {
			this.memberRecords = deepClone(vals(memberModules));
			this.projectRecords = deepClone(vals(projectModules));
			this.goalRecords = deepClone(vals(goalModules));
			this.oneOnOneRecords = deepClone(vals(oneOnOneModules));
			this.reviewRecords = deepClone(vals(reviewModules));
		}
		this.aiResponses = deepClone(aiResponsesJson);
		this.orgDocs = deepClone(orgDocsJson);
	}

	// ---------------------------------------------------------------------------
	// localStorage 永続化
	// ---------------------------------------------------------------------------

	private loadFromStorage(): StorageSnapshot | null {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return null;
			return JSON.parse(raw) as StorageSnapshot;
		} catch {
			return null;
		}
	}

	private persist(): void {
		try {
			const snapshot: StorageSnapshot = {
				members: this.memberRecords,
				projects: this.projectRecords,
				goals: this.goalRecords,
				oneOnOnes: this.oneOnOneRecords,
				reviews: this.reviewRecords,
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
		} catch {
			// localStorage full or unavailable — ignore
		}
	}

	/** seed data にリセット（localStorage をクリア） */
	reset(): void {
		localStorage.removeItem(STORAGE_KEY);
		this.memberRecords = deepClone(vals(memberModules));
		this.projectRecords = deepClone(vals(projectModules));
		this.goalRecords = deepClone(vals(goalModules));
		this.oneOnOneRecords = deepClone(vals(oneOnOneModules));
		this.reviewRecords = deepClone(vals(reviewModules));
	}

	// ---------------------------------------------------------------------------
	// Read — テーブルを JOIN して API 型を組み立てる
	// ---------------------------------------------------------------------------

	getMembers(): MemberSummary[] {
		return this.memberRecords.map((m) => ({
			id: m.id,
			slug: m.slug,
			name: m.name,
			role: m.role,
			team: m.team,
			teamShort: m.teamShort,
			joinedAt: m.joinedAt,
			projects: this.projectRecords
				.filter((p) => p.memberId === m.id)
				.map(({ id: _id, memberId: _mid, ...rest }) => rest),
			mainProject: m.mainProject,
			rdPct: m.rdPct,
		}));
	}

	getMemberDetail(id: string): MemberDetail | undefined {
		const m = this.memberRecords.find((r) => r.id === id);
		if (!m) return undefined;

		const projects = this.projectRecords
			.filter((p) => p.memberId === m.id)
			.map(({ id: _id, memberId: _mid, ...rest }) => rest);

		const goals = this.goalRecords.filter((g) => g.memberId === m.id);
		const activeGoal = goals.find((g) => g.period === m.activePeriod) ?? null;
		const goalsByPeriod: Record<string, GoalsData> = {};
		for (const g of goals) {
			goalsByPeriod[g.period] = g;
		}

		const oneOnOnes = this.oneOnOneRecords.filter((o) => o.memberId === m.id);
		const reviews = this.reviewRecords.filter((r) => r.memberId === m.id);

		return {
			id: m.id,
			slug: m.slug,
			name: m.name,
			role: m.role,
			team: m.team,
			teamShort: m.teamShort,
			joinedAt: m.joinedAt,
			projects,
			mainProject: m.mainProject,
			rdPct: m.rdPct,
			skills: m.skills,
			expectedRole: m.expectedRole,
			rawMarkdown: m.rawMarkdown,
			goals: activeGoal,
			goalsByPeriod,
			activePeriod: m.activePeriod,
			oneOnOnes,
			reviews,
		};
	}

	getAiResponse(key: keyof typeof aiResponsesJson): unknown {
		return this.aiResponses[key];
	}

	getHearingQuestions(): { question: string; intent: string }[] {
		return this.aiResponses.hearingQuestions;
	}

	getOrgDocs(): { orgPolicy: string; criteria: string; guidelines: string } {
		return this.orgDocs;
	}

	buildTeamMatrix(period: string): TeamPeriodMatrix {
		const members: MemberPeriodStatus[] = this.memberRecords.map((m) => ({
			memberId: m.id,
			memberName: m.name,
			team: m.teamShort,
			hasGoal: this.goalRecords.some(
				(g) => g.memberId === m.id && g.period === period,
			),
			oneOnOneMonths: this.oneOnOneRecords
				.filter((o) => o.memberId === m.id)
				.map((o) => o.date.split("-")[1]),
			hasReview: this.reviewRecords.some((r) => r.memberId === m.id),
		}));
		return { period, members };
	}

	// ---------------------------------------------------------------------------
	// Write — in-memory 更新 + localStorage 永続化
	// ---------------------------------------------------------------------------

	addMember(input: {
		name: string;
		role: string;
		team: string;
		teamShort: string;
		joinedAt: string;
		mainProject?: string;
		rdPct?: number;
		projects?: {
			name: string;
			april: number;
			may: number;
			june: number;
			avgPct: number;
		}[];
	}): MemberRecord {
		const id = generateId("mbr");
		const slug = toSlug(input.name);

		const record: MemberRecord = {
			id,
			slug,
			name: input.name,
			role: input.role,
			team: input.team,
			teamShort: input.teamShort,
			joinedAt: input.joinedAt,
			mainProject: input.mainProject ?? "",
			rdPct: input.rdPct ?? 0,
			skills: { technical: "", experience: "", strengths: "", challenges: "" },
			expectedRole: { current: "", longTerm: "" },
			rawMarkdown: "",
			activePeriod: "2026-h1",
		};
		this.memberRecords.push(record);

		if (input.projects) {
			for (const proj of input.projects) {
				this.projectRecords.push({
					id: generateId("proj"),
					memberId: id,
					...proj,
				});
			}
		}

		this.persist();
		return record;
	}

	saveGoals(memberId: string, period: string, content: string): void {
		const m = this.memberRecords.find((r) => r.id === memberId);
		if (!m) return;
		const existing = this.goalRecords.find(
			(g) => g.memberId === m.id && g.period === period,
		);
		if (existing) {
			existing.rawMarkdown = content;
		} else {
			this.goalRecords.push({
				id: generateId("goal"),
				memberId: m.id,
				period,
				memberName: m.name,
				rawMarkdown: content,
			});
		}
		this.persist();
	}

	saveOneOnOne(memberId: string, record: OneOnOneRecord): void {
		const m = this.memberRecords.find((r) => r.id === memberId);
		if (!m) return;
		const idx = this.oneOnOneRecords.findIndex(
			(o) => o.memberId === m.id && o.date === record.date,
		);
		if (idx >= 0) {
			this.oneOnOneRecords[idx] = record;
		} else {
			this.oneOnOneRecords.unshift(record);
		}
		this.persist();
	}

	saveReview(memberId: string, review: ReviewData): void {
		const m = this.memberRecords.find((r) => r.id === memberId);
		if (!m) return;
		const idx = this.reviewRecords.findIndex(
			(r) => r.memberId === m.id && r.period === review.period,
		);
		if (idx >= 0) {
			this.reviewRecords[idx] = review;
		} else {
			this.reviewRecords.unshift(review);
		}
		this.persist();
	}
}

export const mockDb = new MockDatabase();
