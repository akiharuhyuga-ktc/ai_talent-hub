import type { MemberRecord, MemberSummary } from "@/api/generated/types";
import {
	generateMemberId,
	parseProfile,
	serializeProfile,
	toSlug,
} from "./markdown";
import type { MemberCreateInput, MembersStore } from "./types";

// Tauri モジュールは isTauri() が true のときだけ動的に読み込む。
// ブラウザ dev では Vite がこれらを解決する必要がない。

type TauriPathModule = typeof import("@tauri-apps/api/path");
type TauriFsModule = typeof import("@tauri-apps/plugin-fs");

let cachedPath: TauriPathModule | null = null;
let cachedFs: TauriFsModule | null = null;

async function getTauriPath(): Promise<TauriPathModule> {
	if (!cachedPath) {
		cachedPath = await import("@tauri-apps/api/path");
	}
	return cachedPath;
}

async function getTauriFs(): Promise<TauriFsModule> {
	if (!cachedFs) {
		cachedFs = await import("@tauri-apps/plugin-fs");
	}
	return cachedFs;
}

async function membersDir(): Promise<string> {
	const { appDataDir, join } = await getTauriPath();
	const root = await appDataDir();
	return await join(root, "data", "v1", "members");
}

async function ensureMembersDir(): Promise<string> {
	const dir = await membersDir();
	const { exists, mkdir } = await getTauriFs();
	if (!(await exists(dir))) {
		await mkdir(dir, { recursive: true });
	}
	return dir;
}

async function readAllProfiles(): Promise<{ name: string; content: string }[]> {
	const { join } = await getTauriPath();
	const { exists, readDir, readTextFile } = await getTauriFs();
	const dir = await ensureMembersDir();
	const entries = await readDir(dir);
	const profiles: { name: string; content: string }[] = [];
	for (const entry of entries) {
		if (!entry.isDirectory) continue;
		const profilePath = await join(dir, entry.name, "profile.md");
		if (!(await exists(profilePath))) continue;
		const content = await readTextFile(profilePath);
		profiles.push({ name: entry.name, content });
	}
	return profiles;
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

export const tauriMembersStore: MembersStore = {
	async list() {
		const profiles = await readAllProfiles();
		return profiles.map((p) => parseProfile(p.content, p.name)).map(toSummary);
	},

	async get(id: string) {
		const profiles = await readAllProfiles();
		const records = profiles.map((p) => parseProfile(p.content, p.name));
		return records.find((r) => r.id === id) ?? null;
	},

	async create(input: MemberCreateInput) {
		const { join } = await getTauriPath();
		const { exists, mkdir, writeTextFile } = await getTauriFs();
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
		const dir = await ensureMembersDir();
		const memberDir = await join(dir, input.name);
		if (!(await exists(memberDir))) {
			await mkdir(memberDir, { recursive: true });
		}
		await writeTextFile(await join(memberDir, "profile.md"), content);
		return parseProfile(content, input.name);
	},

	async remove(id: string) {
		const { join } = await getTauriPath();
		const { exists, remove } = await getTauriFs();
		const profiles = await readAllProfiles();
		const target = profiles.find((p) => {
			const rec = parseProfile(p.content, p.name);
			return rec.id === id;
		});
		if (!target) return;
		const dir = await ensureMembersDir();
		const memberDir = await join(dir, target.name);
		if (await exists(memberDir)) {
			await remove(memberDir, { recursive: true });
		}
	},
};
