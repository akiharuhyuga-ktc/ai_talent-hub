import type { MemberRecord, MemberSummary } from "@/api/generated/types";
import type { GoalsData, OneOnOneRecord, ReviewData } from "@/lib/types";
import { demoMembersSubdir } from "./demo-mode";
import {
	generateMemberId,
	parseProfile,
	parseProjects,
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

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

async function membersDir(): Promise<string> {
	const { appDataDir, join } = await getTauriPath();
	const root = await appDataDir();
	return await join(root, "data", "v1", demoMembersSubdir());
}

async function ensureMembersDir(): Promise<string> {
	const dir = await membersDir();
	const { exists, mkdir } = await getTauriFs();
	if (!(await exists(dir))) {
		await mkdir(dir, { recursive: true });
	}
	return dir;
}

async function memberSubDir(
	memberId: string,
	kind: "goals" | "one-on-one" | "reviews",
): Promise<string> {
	const { join } = await getTauriPath();
	const root = await ensureMembersDir();
	const dir = await join(root, memberId, kind);
	const { exists, mkdir } = await getTauriFs();
	if (!(await exists(dir))) {
		await mkdir(dir, { recursive: true });
	}
	return dir;
}

async function readAllProfiles(): Promise<{ id: string; content: string }[]> {
	const { join } = await getTauriPath();
	const { exists, readDir, readTextFile } = await getTauriFs();
	const dir = await ensureMembersDir();
	const entries = await readDir(dir);
	const profiles: { id: string; content: string }[] = [];
	for (const entry of entries) {
		if (!entry.isDirectory) continue;
		const profilePath = await join(dir, entry.name, "profile.md");
		if (!(await exists(profilePath))) continue;
		const content = await readTextFile(profilePath);
		profiles.push({ id: entry.name, content });
	}
	return profiles;
}

function profileToRecord(id: string, content: string): MemberRecord {
	// ディレクトリ名 = ID が canonical。profile.md の id コメントより優先する。
	return { ...parseProfile(content), id };
}

async function resolveMember(memberId: string): Promise<MemberRecord | null> {
	const profiles = await readAllProfiles();
	const target = profiles.find((p) => p.id === memberId);
	return target ? profileToRecord(target.id, target.content) : null;
}

async function listSubDirFiles(
	memberId: string,
	kind: "goals" | "one-on-one" | "reviews",
): Promise<{ name: string; content: string }[]> {
	const { join } = await getTauriPath();
	const { exists, readDir, readTextFile } = await getTauriFs();
	const dir = await memberSubDir(memberId, kind);
	if (!(await exists(dir))) return [];
	const entries = await readDir(dir);
	const files: { name: string; content: string }[] = [];
	for (const entry of entries) {
		if (!entry.isFile) continue;
		if (!entry.name.endsWith(".md")) continue;
		const filePath = await join(dir, entry.name);
		const content = await readTextFile(filePath);
		files.push({ name: entry.name.replace(/\.md$/, ""), content });
	}
	return files;
}

async function writeSubDirFile(
	memberId: string,
	kind: "goals" | "one-on-one" | "reviews",
	key: string,
	content: string,
): Promise<void> {
	const { join } = await getTauriPath();
	const { writeTextFile } = await getTauriFs();
	const dir = await memberSubDir(memberId, kind);
	await writeTextFile(await join(dir, `${key}.md`), content);
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
		projects: parseProjects(record.rawMarkdown),
		mainProject: record.mainProject,
		rdPct: record.rdPct,
	};
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export const tauriMembersStore: MembersStore = {
	async list() {
		const profiles = await readAllProfiles();
		return profiles.map((p) => profileToRecord(p.id, p.content)).map(toSummary);
	},

	async get(id: string) {
		return await resolveMember(id);
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
		const memberDir = await join(dir, id);
		if (!(await exists(memberDir))) {
			await mkdir(memberDir, { recursive: true });
		}
		await writeTextFile(await join(memberDir, "profile.md"), content);
		return profileToRecord(id, content);
	},

	async remove(id: string) {
		const { join } = await getTauriPath();
		const { exists, remove } = await getTauriFs();
		const dir = await ensureMembersDir();
		const memberDir = await join(dir, id);
		if (await exists(memberDir)) {
			await remove(memberDir, { recursive: true });
		}
	},
};

// ---------------------------------------------------------------------------
// Goals / 1on1 / Reviews
// ---------------------------------------------------------------------------

export const tauriGoalsStore: GoalsStore = {
	async listForMember(memberId: string) {
		const member = await resolveMember(memberId);
		if (!member) return [];
		const files = await listSubDirFiles(memberId, "goals");
		return files.map<GoalsData>((f) => ({
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

export const tauriOneOnOnesStore: OneOnOnesStore = {
	async listForMember(memberId: string) {
		const files = await listSubDirFiles(memberId, "one-on-one");
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

export const tauriReviewsStore: ReviewsStore = {
	async listForMember(memberId: string) {
		const member = await resolveMember(memberId);
		if (!member) return [];
		const files = await listSubDirFiles(memberId, "reviews");
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
