/**
 * MockDatabase — 目標/1on1/評価の in-memory ストア
 *
 * Phase 1 時点の役割:
 *   - Members / Projects は dataStore (data/v1 ファイル) が master。本クラスは触らない。
 *   - Goals / OneOnOnes / Reviews は localStorage に保存する（Phase 2 で FS 化予定）
 *   - AI 応答モック / 組織ドキュメントは default-responses.ts の既定値を返す
 *
 * 将来: Go backend → MySQL に置き換わり、このファイルは不要になる
 */

import type {
	GoalsData,
	OneOnOneRecord,
	ReviewData,
	TeamPeriodMatrix,
} from "@/lib/types";
import {
	type AiResponses,
	DEFAULT_AI_RESPONSES,
	DEFAULT_ORG_DOCS,
	type OrgDocs,
} from "./default-responses";

// ---------------------------------------------------------------------------
// import.meta.glob でテーブル別ディレクトリから seed data を読み込む
//
// data/ はローカル専用ディレクトリ（gitignore対象）で、各開発者が convert-data
// スキルなどでローカル生成する。ファイルが未生成でも起動できるよう、全て glob
// 経由で読み込み、存在しない場合は空として扱う。
// ---------------------------------------------------------------------------

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

const aiResponsesModules = import.meta.glob<AiResponses>(
	"./data/ai-responses.json",
	{ eager: true, import: "default" },
);
const orgDocsModules = import.meta.glob<OrgDocs>("./data/org-docs.json", {
	eager: true,
	import: "default",
});

const loadedAiResponses =
	Object.values(aiResponsesModules)[0] ?? DEFAULT_AI_RESPONSES;
const loadedOrgDocs = Object.values(orgDocsModules)[0] ?? DEFAULT_ORG_DOCS;

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

// ---------------------------------------------------------------------------
// MockDatabase
// ---------------------------------------------------------------------------

interface StorageSnapshot {
	goals: GoalsData[];
	oneOnOnes: OneOnOneRecord[];
	reviews: ReviewData[];
}

interface MemberExtras {
	goalsByPeriod: Record<string, GoalsData>;
	oneOnOnes: OneOnOneRecord[];
	reviews: ReviewData[];
}

class MockDatabase {
	private goalRecords: GoalsData[];
	private oneOnOneRecords: OneOnOneRecord[];
	private reviewRecords: ReviewData[];
	private aiResponses: AiResponses;
	private orgDocs: OrgDocs;

	constructor() {
		const saved = this.loadFromStorage();
		if (saved) {
			this.goalRecords = saved.goals;
			this.oneOnOneRecords = saved.oneOnOnes;
			this.reviewRecords = saved.reviews;
		} else {
			this.goalRecords = deepClone(vals(goalModules));
			this.oneOnOneRecords = deepClone(vals(oneOnOneModules));
			this.reviewRecords = deepClone(vals(reviewModules));
		}
		this.aiResponses = deepClone(loadedAiResponses);
		this.orgDocs = deepClone(loadedOrgDocs);
	}

	// ---------------------------------------------------------------------------
	// localStorage 永続化 — goals/1on1/reviews のみ
	// ---------------------------------------------------------------------------

	private loadFromStorage(): StorageSnapshot | null {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as Partial<StorageSnapshot> & {
				members?: unknown;
				projects?: unknown;
			};
			// 旧形式（members/projects を含む）の場合は goals/1on1/reviews のみ救出
			return {
				goals: Array.isArray(parsed.goals) ? parsed.goals : [],
				oneOnOnes: Array.isArray(parsed.oneOnOnes) ? parsed.oneOnOnes : [],
				reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
			};
		} catch {
			return null;
		}
	}

	private persist(): void {
		try {
			const snapshot: StorageSnapshot = {
				goals: this.goalRecords,
				oneOnOnes: this.oneOnOneRecords,
				reviews: this.reviewRecords,
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
		} catch {
			// localStorage full or unavailable — ignore
		}
	}

	reset(): void {
		localStorage.removeItem(STORAGE_KEY);
		this.goalRecords = deepClone(vals(goalModules));
		this.oneOnOneRecords = deepClone(vals(oneOnOneModules));
		this.reviewRecords = deepClone(vals(reviewModules));
	}

	// ---------------------------------------------------------------------------
	// Read
	// ---------------------------------------------------------------------------

	getMemberExtras(memberId: string): MemberExtras {
		const goals = this.goalRecords.filter((g) => g.memberId === memberId);
		const goalsByPeriod: Record<string, GoalsData> = {};
		for (const g of goals) {
			goalsByPeriod[g.period] = g;
		}
		const oneOnOnes = this.oneOnOneRecords.filter(
			(o) => o.memberId === memberId,
		);
		const reviews = this.reviewRecords.filter((r) => r.memberId === memberId);
		return { goalsByPeriod, oneOnOnes, reviews };
	}

	hasGoal(memberId: string, period: string): boolean {
		return this.goalRecords.some(
			(g) => g.memberId === memberId && g.period === period,
		);
	}

	oneOnOneMonthsFor(memberId: string): string[] {
		return this.oneOnOneRecords
			.filter((o) => o.memberId === memberId)
			.map((o) => o.date.split("-")[1]);
	}

	hasReview(memberId: string): boolean {
		return this.reviewRecords.some((r) => r.memberId === memberId);
	}

	getAiResponse(key: keyof AiResponses): unknown {
		return this.aiResponses[key];
	}

	getHearingQuestions(): { question: string; intent: string }[] {
		return this.aiResponses.hearingQuestions;
	}

	getOrgDocs(): OrgDocs {
		return this.orgDocs;
	}

	/**
	 * TeamPeriodMatrix の members 配列は dataStore 側（呼び出し元）で構築する。
	 * ここでは空の枠だけ返す。
	 */
	buildTeamMatrixShell(period: string): TeamPeriodMatrix {
		return { period, members: [] };
	}

	// ---------------------------------------------------------------------------
	// Write
	// ---------------------------------------------------------------------------

	saveGoals(memberId: string, period: string, content: string): void {
		const existing = this.goalRecords.find(
			(g) => g.memberId === memberId && g.period === period,
		);
		if (existing) {
			existing.rawMarkdown = content;
		} else {
			this.goalRecords.push({
				id: generateId("goal"),
				memberId,
				period,
				memberName: "",
				rawMarkdown: content,
			});
		}
		this.persist();
	}

	saveOneOnOne(memberId: string, record: OneOnOneRecord): void {
		const idx = this.oneOnOneRecords.findIndex(
			(o) => o.memberId === memberId && o.date === record.date,
		);
		if (idx >= 0) {
			this.oneOnOneRecords[idx] = record;
		} else {
			this.oneOnOneRecords.unshift(record);
		}
		this.persist();
	}

	saveReview(memberId: string, review: ReviewData): void {
		const idx = this.reviewRecords.findIndex(
			(r) => r.memberId === memberId && r.period === review.period,
		);
		if (idx >= 0) {
			this.reviewRecords[idx] = review;
		} else {
			this.reviewRecords.unshift(review);
		}
		this.persist();
	}

	removeGoalsFor(memberId: string): void {
		this.goalRecords = this.goalRecords.filter((g) => g.memberId !== memberId);
		this.oneOnOneRecords = this.oneOnOneRecords.filter(
			(o) => o.memberId !== memberId,
		);
		this.reviewRecords = this.reviewRecords.filter(
			(r) => r.memberId !== memberId,
		);
		this.persist();
	}
}

export const mockDb = new MockDatabase();
