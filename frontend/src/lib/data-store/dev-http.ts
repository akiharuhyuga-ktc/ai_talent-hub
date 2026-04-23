import type { MemberRecord, MemberSummary } from "@/api/generated/types";
import {
	generateMemberId,
	parseProfile,
	serializeProfile,
	toSlug,
} from "./markdown";
import type { MemberCreateInput, MembersStore } from "./types";

interface ListResponse {
	profiles: { name: string; content: string }[];
}

async function fetchProfiles(): Promise<{ name: string; content: string }[]> {
	const res = await fetch("/api/fs/members");
	if (!res.ok) throw new Error(`failed to list members: ${res.status}`);
	const data = (await res.json()) as ListResponse;
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

export const devMembersStore: MembersStore = {
	async list() {
		const profiles = await fetchProfiles();
		return profiles.map((p) => parseProfile(p.content, p.name)).map(toSummary);
	},

	async get(id: string) {
		const profiles = await fetchProfiles();
		const records = profiles.map((p) => parseProfile(p.content, p.name));
		return records.find((r) => r.id === id) ?? null;
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
		const profiles = await fetchProfiles();
		const records = profiles.map((p) => parseProfile(p.content, p.name));
		const target = records.find((r) => r.id === id);
		if (!target) return;
		const dirName =
			profiles.find((p) => {
				const rec = parseProfile(p.content, p.name);
				return rec.id === id;
			})?.name ?? target.name;
		await deleteMemberDir(dirName);
	},
};
