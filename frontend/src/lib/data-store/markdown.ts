import type { MemberRecord } from "@/api/generated/types";

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
	const regex = new RegExp(`^\\-\\s*${label}：\\s*(.+)$`, "m");
	const match = markdown.match(regex);
	return match ? match[1].trim() : "";
}

function extractHtmlMeta(markdown: string, key: string): string {
	const regex = new RegExp(`<!--\\s*${key}:\\s*([^\\s-][^]*?)\\s*-->`);
	const match = markdown.match(regex);
	return match ? match[1].trim() : "";
}

export function parseProfile(
	markdown: string,
	fallbackName: string,
): MemberRecord {
	const name = extractField(markdown, "名前") || fallbackName;
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
		skills: { technical: "", experience: "", strengths: "", challenges: "" },
		expectedRole: { current: "", longTerm: "" },
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
