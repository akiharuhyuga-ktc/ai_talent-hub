export type HalfYear = "h1" | "h2";
export type Period = `${number}-${"h1" | "h2"}`;

export const PERIOD_CONFIG = {
	h1: {
		startMonth: 4,
		endMonth: 9,
		label: "上期",
		displayRange: "4月〜9月",
	},
	h2: {
		startMonth: 10,
		endMonth: 3,
		label: "下期",
		displayRange: "10月〜3月",
	},
} as const;

export function getActivePeriod(date: Date = new Date()): Period {
	const month = date.getMonth() + 1;
	const year = date.getFullYear();
	if (month >= 4 && month <= 9) return `${year}-h1` as Period;
	if (month >= 10) return `${year}-h2` as Period;
	return `${year - 1}-h2` as Period;
}

export function formatPeriodLabel(period: string): string {
	const match = period.match(/^(\d{4})-(h[12])$/);
	if (!match) return period;
	const [, year, half] = match;
	const config = PERIOD_CONFIG[half as HalfYear];
	return `${year}年${config.label}（${config.displayRange}）`;
}

export function sortPeriods(periods: string[]): string[] {
	return [...periods].sort((a, b) => b.localeCompare(a));
}
