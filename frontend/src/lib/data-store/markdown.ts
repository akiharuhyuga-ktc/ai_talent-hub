import type { MemberRecord, ProjectAllocation } from "@/api/generated/types";

/**
 * profile.md 形式のシリアライズ／パース
 *
 * 基本構造:
 *   - 名前：{name}
 *   - 役職：{role}
 *   - チーム：{team}
 *   - 入社年：{YYYY-MM}
 *   - メインプロジェクト：{mainProject}
 *   - R&D配分：{rdPct}%
 *
 * 今フェーズは最低限のフィールドのみ。追加フィールド（skills / expectedRole / projects 等）
 * は詳細画面から編集する後続フェーズで対応する。
 */

export interface ProfileDraft {
	id: string;
	slug: string;
	name: string;
	role: string;
	team: string;
	teamShort: string;
	joinedAt: string;
	mainProject: string;
	rdPct: number;
}

function escapeField(value: string): string {
	return value.replace(/\r?\n/g, " ").trim();
}

export function serializeProfile(draft: ProfileDraft): string {
	const lines = [
		`# ${draft.name}`,
		"",
		`- 名前：${escapeField(draft.name)}`,
		`- 役職：${escapeField(draft.role)}`,
		`- チーム：${escapeField(draft.team)}`,
		`- チーム分類：${escapeField(draft.teamShort)}`,
		`- 入社年：${escapeField(draft.joinedAt)}`,
		`- メインプロジェクト：${escapeField(draft.mainProject)}`,
		`- R&D配分：${draft.rdPct}%`,
		"",
		`<!-- id: ${draft.id} -->`,
		`<!-- slug: ${draft.slug} -->`,
		"",
	];
	return lines.join("\n");
}

function extractField(markdown: string, label: string): string {
	const regex = new RegExp(
		`-\\s*${label}[：:]([\\s\\S]*?)(?=\\n-\\s|\\n##|\\n<!--|$)`,
	);
	const match = markdown.match(regex);
	return match ? match[1].trim() : "";
}

function parseProjectLine(line: string): ProjectAllocation | null {
	const match = line.match(
		/^-\s+(.+?)[：:]\s*4月\s*(\d+)%\s*\/\s*5月\s*(\d+)%\s*\/\s*6月\s*(\d+)%/,
	);
	if (!match) return null;
	const [, name, a, m, j] = match;
	const april = Number.parseInt(a, 10);
	const may = Number.parseInt(m, 10);
	const june = Number.parseInt(j, 10);
	return {
		name: name.trim(),
		april,
		may,
		june,
		avgPct: Math.round((april + may + june) / 3),
	};
}

export function parseProjects(markdown: string): ProjectAllocation[] {
	const sectionMatch = markdown.match(
		/## 担当プロジェクト.*?\n([\s\S]*?)(?=\n##|$)/,
	);
	if (!sectionMatch) return [];
	return sectionMatch[1]
		.split("\n")
		.map(parseProjectLine)
		.filter((p): p is ProjectAllocation => p !== null);
}

function extractHtmlMeta(markdown: string, key: string): string {
	const regex = new RegExp(`<!--\\s*${key}:\\s*([^\\s-][^]*?)\\s*-->`);
	const match = markdown.match(regex);
	return match ? match[1].trim() : "";
}

export function parseProfile(markdown: string): MemberRecord {
	const name = extractField(markdown, "名前");
	const role = extractField(markdown, "役職");
	const team = extractField(markdown, "チーム");
	const teamShort = extractField(markdown, "チーム分類") || "Flutter";
	const joinedAt = extractField(markdown, "入社年");
	const mainProject = extractField(markdown, "メインプロジェクト");
	const rdPctStr = extractField(markdown, "R&D配分").replace(/%$/, "").trim();
	const rdPct = Number.parseInt(rdPctStr, 10);
	const id =
		extractHtmlMeta(markdown, "id") || `mbr_${Date.now().toString(36)}`;
	const slug = extractHtmlMeta(markdown, "slug") || toSlug(name);

	const roleSectionMatch = markdown.match(
		/## 期待する役割\n([\s\S]*?)(?=\n##|\n<!--|$)/,
	);
	const roleSection = roleSectionMatch ? roleSectionMatch[1] : "";
	const longTermMatch = roleSection.match(
		/- 中長期的なキャリア方向性[：:]([\s\S]*?)(?=\n-|\n<!--|$)/,
	);
	const currentRole = roleSection
		.split("\n")
		.filter(
			(l) => l.startsWith("- ") && !l.includes("中長期的なキャリア方向性"),
		)
		.map((l) => l.replace(/^- /, ""))
		.join("\n")
		.trim();

	return {
		id,
		slug,
		name,
		role,
		team,
		teamShort,
		joinedAt,
		mainProject,
		rdPct: Number.isFinite(rdPct) ? rdPct : 0,
		skills: {
			technical: extractField(markdown, "技術スキル"),
			experience: extractField(markdown, "業務経験"),
			strengths: extractField(markdown, "強み"),
			challenges: extractField(markdown, "成長課題"),
		},
		expectedRole: {
			current: currentRole,
			longTerm: longTermMatch ? longTermMatch[1].trim() : "",
		},
		rawMarkdown: markdown,
		activePeriod: "2026-h1",
	};
}

export function toSlug(name: string): string {
	return (
		name
			.normalize("NFKC")
			.replace(/\s+/g, "-")
			.replace(/[^\w-]/g, "")
			.toLowerCase() || `member-${Date.now()}`
	);
}

export function generateMemberId(): string {
	const ts = Date.now().toString(36);
	const rand = Math.random().toString(36).slice(2, 8);
	return `mbr_${ts}${rand}`;
}
