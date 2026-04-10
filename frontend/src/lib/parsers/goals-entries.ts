import type { GoalProgressEntry } from "@/lib/types";

export function parseGoalEntries(
	rawMarkdown: string | null,
): GoalProgressEntry[] {
	if (!rawMarkdown) return [];

	const isWizardFormat = /目標[①②③④⑤⑥⑦⑧⑨⑩]/.test(rawMarkdown);

	if (isWizardFormat) {
		return parseWizardFormat(rawMarkdown);
	}
	return parseTemplateFormat(rawMarkdown.split("\n"));
}

function parseWizardFormat(raw: string): GoalProgressEntry[] {
	const entries: GoalProgressEntry[] = [];
	const matches = Array.from(
		raw.matchAll(/目標([①②③④⑤⑥⑦⑧⑨⑩\d]+)(?:（([^）]*)）)?[：:](.+)/g),
	);

	for (let i = 0; i < matches.length; i++) {
		const match = matches[i];
		const label = `目標${match[1]}${match[2] ? `（${match[2]}）` : ""}`;
		const goalText = match[3].trim();

		// biome-ignore lint/style/noNonNullAssertion: matchAll always provides index
		const startIdx = match.index! + match[0].length;
		// biome-ignore lint/style/noNonNullAssertion: matchAll always provides index
		const endIdx = i + 1 < matches.length ? matches[i + 1].index! : raw.length;
		const section = raw.slice(startIdx, endIdx);

		const getField = (prefix: string): string => {
			const re = new RegExp(`[-└]\\s*${prefix}[：:]\\s*(.+)`, "m");
			const m = section.match(re);
			return m ? m[1].trim() : "";
		};

		entries.push({
			goalLabel: label,
			goalText,
			achievedState: getField("達成した姿"),
			milestone: getField("中間確認"),
			verificationMethod: getField("検証方法"),
			status: "",
			progressComment: "",
		});
	}

	return entries;
}

function parseTemplateFormat(lines: string[]): GoalProgressEntry[] {
	const entries: GoalProgressEntry[] = [];
	let currentEntry: Partial<GoalProgressEntry> | null = null;

	for (const line of lines) {
		const headerMatch = line.match(/^###\s*目標(\d+)/);
		if (headerMatch) {
			if (currentEntry?.goalLabel) {
				entries.push(fillDefaults(currentEntry));
			}
			currentEntry = { goalLabel: `目標${headerMatch[1]}` };
			continue;
		}

		if (!currentEntry) continue;

		if (line.startsWith("- 目標内容：") || line.startsWith("- 目標内容:")) {
			currentEntry.goalText = line.replace(/^- 目標内容[：:]/, "").trim();
		} else if (line.startsWith("- 達成指標") || line.startsWith("- KPI")) {
			currentEntry.verificationMethod = line
				.replace(/^- (?:達成指標（KPI）|KPI)[：:]/, "")
				.trim();
		} else if (
			line.startsWith("- 中間マイルストーン") ||
			line.startsWith("- 中間確認")
		) {
			currentEntry.milestone = line
				.replace(/^- (?:中間マイルストーン|中間確認)[：:]/, "")
				.trim();
		}
	}

	if (currentEntry?.goalLabel) {
		entries.push(fillDefaults(currentEntry));
	}

	return entries;
}

function fillDefaults(partial: Partial<GoalProgressEntry>): GoalProgressEntry {
	return {
		goalLabel: partial.goalLabel || "",
		goalText: partial.goalText || "",
		achievedState: partial.achievedState || "",
		milestone: partial.milestone || "",
		verificationMethod: partial.verificationMethod || "",
		status: "",
		progressComment: "",
	};
}
