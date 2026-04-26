import type { MemberRecord, MemberSummary } from "@/api/generated/types";
import type { OneOnOneRecord, ReviewData } from "@/lib/types";
import { demoQuerySuffix } from "./demo-mode";
import {
	generateMemberId,
	parseProfile,
	serializeProfile,
	toSlug,
} from "./markdown";
import type {
	GoalsStore,
	MemberCreateInput,
	MembersStore,
	OneOnOnesStore,
	ReviewsStore,
} from "./types";

// ---------------------------------------------------------------------------
// Low-level fetch helpers
// ---------------------------------------------------------------------------

interface ProfilesResponse {
	profiles: { id: string; content: string }[];
}

interface SubDirResponse {
	files: { name: string; content: string }[];
}

async function fetchProfiles(): Promise<{ id: string; content: string }[]> {
	const res = await fetch(`/api/fs/members${demoQuerySuffix()}`);
	if (!res.ok) throw new Error(`failed to list members: ${res.status}`);
	const data = (await res.json()) as ProfilesResponse;
	return data.profiles;
}

async function writeProfile(id: string, content: string): Promise<void> {
	const res = await fetch(
		`/api/fs/members/${encodeURIComponent(id)}/profile${demoQuerySuffix()}`,
		{
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content }),
		},
	);
	if (!res.ok) throw new Error(`failed to write profile: ${res.status}`);
}

async function deleteMemberDir(id: string): Promise<void> {
	const res = await fetch(
		`/api/fs/members/${encodeURIComponent(id)}${demoQuerySuffix()}`,
		{ method: "DELETE" },
	);
	if (res.status === 404) return;
	if (!res.ok) throw new Error(`failed to delete member: ${res.status}`);
}

async function listSubDir(
	memberId: string,
	kind: "goals" | "one-on-one" | "reviews",
): Promise<{ name: string; content: string }[]> {
	const res = await fetch(
		`/api/fs/members/${encodeURIComponent(memberId)}/${kind}${demoQuerySuffix()}`,
	);
	if (res.status === 404) return [];
	if (!res.ok) throw new Error(`failed to list ${kind}: ${res.status}`);
	const data = (await res.json()) as SubDirResponse;
	return data.files;
}

async function writeSubDirFile(
	memberId: string,
	kind: "goals" | "one-on-one" | "reviews",
	key: string,
	content: string,
): Promise<void> {
	const res = await fetch(
		`/api/fs/members/${encodeURIComponent(memberId)}/${kind}/${encodeURIComponent(
			key,
		)}${demoQuerySuffix()}`,
		{
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content }),
		},
	);
	if (!res.ok) throw new Error(`failed to write ${kind}/${key}: ${res.status}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSummary(record: MemberRecord): MemberSummary {
	return {
		id: record.id,
		slug: record.slug,
		name: record.name,
		role: record.role,
		team: record.team,
		teamShort: record.teamShort,
		joinedAt: record.joinedAt,
		projects: [],
		mainProject: record.mainProject,
		rdPct: record.rdPct,
	};
}

function profileToRecord(id: string, content: string): MemberRecord {
	// ディレクトリ名 = ID が canonical。profile.md の id コメントより優先する。
	return { ...parseProfile(content), id };
}

async function resolveMember(memberId: string): Promise<MemberRecord | null> {
	const profiles = await fetchProfiles();
	const target = profiles.find((p) => p.id === memberId);
	return target ? profileToRecord(target.id, target.content) : null;
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export const devMembersStore: MembersStore = {
	async list() {
		const profiles = await fetchProfiles();
		return profiles.map((p) => profileToRecord(p.id, p.content)).map(toSummary);
	},

	async get(id: string) {
		return await resolveMember(id);
	},

	async create(input: MemberCreateInput) {
		const id = generateMemberId();
		const slug = toSlug(input.name);
		const draft = {
			id,
			slug,
			name: input.name,
			role: input.role,
			team: input.team,
			teamShort: input.teamShort,
			joinedAt: input.joinedAt,
			mainProject: input.mainProject ?? "",
			rdPct: input.rdPct ?? 0,
		};
		const content = serializeProfile(draft);
		await writeProfile(id, content);
		return profileToRecord(id, content);
	},

	async remove(id: string) {
		await deleteMemberDir(id);
	},
};

// ---------------------------------------------------------------------------
// Goals / 1on1 / Reviews
// ---------------------------------------------------------------------------

export const devGoalsStore: GoalsStore = {
	async listForMember(memberId: string) {
		const member = await resolveMember(memberId);
		if (!member) return [];
		const files = await listSubDir(memberId, "goals");
		return files.map((f) => ({
			id: `goal_${memberId}_${f.name}`,
			memberId,
			period: f.name,
			memberName: member.name,
			rawMarkdown: f.content,
		}));
	},
	async save(memberId: string, period: string, content: string) {
		await writeSubDirFile(memberId, "goals", period, content);
	},
};

export const devOneOnOnesStore: OneOnOnesStore = {
	async listForMember(memberId: string) {
		const files = await listSubDir(memberId, "one-on-one");
		return files
			.map<OneOnOneRecord>((f) => ({
				id: `oo_${memberId}_${f.name.replace("-", "")}`,
				memberId,
				date: f.name,
				rawMarkdown: f.content,
			}))
			.sort((a, b) => b.date.localeCompare(a.date));
	},
	async save(memberId: string, yearMonth: string, content: string) {
		await writeSubDirFile(memberId, "one-on-one", yearMonth, content);
	},
};

export const devReviewsStore: ReviewsStore = {
	async listForMember(memberId: string) {
		const member = await resolveMember(memberId);
		if (!member) return [];
		const files = await listSubDir(memberId, "reviews");
		return files
			.map<ReviewData>((f) => ({
				id: `rev_${memberId}_${f.name}`,
				memberId,
				period: f.name,
				grade: "",
				roleName: member.role,
				h2Eval: "",
				annualEval: "",
				promotion: false,
				feedbackPoints: "",
				feedbackExpectations: "",
				evaluatorComments: [],
				rawMarkdown: f.content,
			}))
			.sort((a, b) => b.period.localeCompare(a.period));
	},
	async save(memberId: string, period: string, content: string) {
		await writeSubDirFile(memberId, "reviews", period, content);
	},
};
