import type { MemberRecord, MemberSummary } from "@/api/generated/types";
import type { OneOnOneRecord, ReviewData } from "@/lib/types";
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
	profiles: { name: string; content: string }[];
}

interface SubDirResponse {
	files: { name: string; content: string }[];
}

async function fetchProfiles(): Promise<{ name: string; content: string }[]> {
	const res = await fetch("/api/fs/members");
	if (!res.ok) throw new Error(`failed to list members: ${res.status}`);
	const data = (await res.json()) as ProfilesResponse;
	return data.profiles;
}

async function writeProfile(name: string, content: string): Promise<void> {
	const res = await fetch(
		`/api/fs/members/${encodeURIComponent(name)}/profile`,
		{
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content }),
		},
	);
	if (!res.ok) throw new Error(`failed to write profile: ${res.status}`);
}

async function deleteMemberDir(name: string): Promise<void> {
	const res = await fetch(`/api/fs/members/${encodeURIComponent(name)}`, {
		method: "DELETE",
	});
	if (res.status === 404) return;
	if (!res.ok) throw new Error(`failed to delete member: ${res.status}`);
}

async function listSubDir(
	memberName: string,
	kind: "goals" | "one-on-one" | "reviews",
): Promise<{ name: string; content: string }[]> {
	const res = await fetch(
		`/api/fs/members/${encodeURIComponent(memberName)}/${kind}`,
	);
	if (res.status === 404) return [];
	if (!res.ok) throw new Error(`failed to list ${kind}: ${res.status}`);
	const data = (await res.json()) as SubDirResponse;
	return data.files;
}

async function writeSubDirFile(
	memberName: string,
	kind: "goals" | "one-on-one" | "reviews",
	key: string,
	content: string,
): Promise<void> {
	const res = await fetch(
		`/api/fs/members/${encodeURIComponent(memberName)}/${kind}/${encodeURIComponent(
			key,
		)}`,
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

async function resolveMember(memberId: string): Promise<MemberRecord | null> {
	const profiles = await fetchProfiles();
	const records = profiles.map((p) => parseProfile(p.content, p.name));
	return records.find((r) => r.id === memberId) ?? null;
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export const devMembersStore: MembersStore = {
	async list() {
		const profiles = await fetchProfiles();
		return profiles.map((p) => parseProfile(p.content, p.name)).map(toSummary);
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
		await writeProfile(input.name, content);
		return parseProfile(content, input.name);
	},

	async remove(id: string) {
		const target = await resolveMember(id);
		if (!target) return;
		await deleteMemberDir(target.name);
	},
};

// ---------------------------------------------------------------------------
// Goals / 1on1 / Reviews
// ---------------------------------------------------------------------------

export const devGoalsStore: GoalsStore = {
	async listForMember(memberId: string) {
		const member = await resolveMember(memberId);
		if (!member) return [];
		const files = await listSubDir(member.name, "goals");
		return files.map((f) => ({
			id: `goal_${memberId}_${f.name}`,
			memberId,
			period: f.name,
			memberName: member.name,
			rawMarkdown: f.content,
		}));
	},
	async save(memberId: string, period: string, content: string) {
		const member = await resolveMember(memberId);
		if (!member) throw new Error(`member not found: ${memberId}`);
		await writeSubDirFile(member.name, "goals", period, content);
	},
};

export const devOneOnOnesStore: OneOnOnesStore = {
	async listForMember(memberId: string) {
		const member = await resolveMember(memberId);
		if (!member) return [];
		const files = await listSubDir(member.name, "one-on-one");
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
		const member = await resolveMember(memberId);
		if (!member) throw new Error(`member not found: ${memberId}`);
		await writeSubDirFile(member.name, "one-on-one", yearMonth, content);
	},
};

export const devReviewsStore: ReviewsStore = {
	async listForMember(memberId: string) {
		const member = await resolveMember(memberId);
		if (!member) return [];
		const files = await listSubDir(member.name, "reviews");
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
		const member = await resolveMember(memberId);
		if (!member) throw new Error(`member not found: ${memberId}`);
		await writeSubDirFile(member.name, "reviews", period, content);
	},
};
