import type { ParsedGoals, SingleGoal } from "../types";

const CIRCLE_NUM_MAP: Record<string, number> = {
	"①": 1,
	"②": 2,
	"③": 3,
	"④": 4,
	"⑤": 5,
	"⑥": 6,
	"⑦": 7,
	"⑧": 8,
	"⑨": 9,
	"⑩": 10,
};

const NUM_CIRCLE_MAP: Record<number, string> = {
	1: "①",
	2: "②",
	3: "③",
	4: "④",
	5: "⑤",
	6: "⑥",
	7: "⑦",
	8: "⑧",
	9: "⑨",
	10: "⑩",
};

const GOAL_HEADING_RE =
	/^#{0,4}\s*\*{0,2}\s*目標([①②③④⑤⑥⑦⑧⑨⑩])[（(](.+?)[）)][：:](.+?)(?:\*{0,2})$/;

export function parseGoalsToSections(markdown: string): ParsedGoals {
	const lines = markdown.split("\n");

	const goalStarts: {
		lineIndex: number;
		label: string;
		type: string;
		title: string;
	}[] = [];
	for (let i = 0; i < lines.length; i++) {
		const match = lines[i].match(GOAL_HEADING_RE);
		if (match) {
			goalStarts.push({
				lineIndex: i,
				label: match[1],
				type: match[2],
				title: match[3].trim(),
			});
		}
	}

	if (goalStarts.length === 0) {
		return { header: markdown, goals: [], footer: "" };
	}

	const header = lines.slice(0, goalStarts[0].lineIndex).join("\n");

	const goals: SingleGoal[] = goalStarts.map((start, idx) => {
		const endLine =
			idx < goalStarts.length - 1
				? goalStarts[idx + 1].lineIndex
				: findFooterStart(lines, start.lineIndex + 1);
		const content = lines.slice(start.lineIndex, endLine).join("\n").trimEnd();
		return {
			index: CIRCLE_NUM_MAP[start.label] ?? idx + 1,
			label: start.label,
			type: start.type,
			title: start.title,
			content,
		};
	});

	const lastGoalEnd = findFooterStart(
		lines,
		goalStarts[goalStarts.length - 1].lineIndex + 1,
	);
	const footer = lines.slice(lastGoalEnd).join("\n").trimStart();

	return { header, goals, footer };
}

function findFooterStart(lines: string[], fromLine: number): number {
	for (let i = fromLine; i < lines.length; i++) {
		const line = lines[i];
		if (GOAL_HEADING_RE.test(line)) continue;
		if (/^#{1,2}\s/.test(line)) return i;
	}
	return lines.length;
}

export function mergeGoalSections(goals: SingleGoal[], footer: string): string {
	const parts = goals.map((g, idx) => {
		const newNum = idx + 1;
		const newLabel = NUM_CIRCLE_MAP[newNum] || g.label;
		if (newLabel === g.label) return g.content;
		return g.content.replace(
			new RegExp(`目標${escapeRegex(g.label)}`, "g"),
			`目標${newLabel}`,
		);
	});
	if (footer.trim()) {
		parts.push(footer.trim());
	}
	return parts.join("\n\n");
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function stripGoalHeading(content: string): string {
	return content
		.replace(
			/^#{0,4}\s*\*{0,2}\s*目標[①②③④⑤⑥⑦⑧⑨⑩][（(].+?[）)][：:].+?(?:\*{0,2})$\n*/m,
			"",
		)
		.trimStart();
}
