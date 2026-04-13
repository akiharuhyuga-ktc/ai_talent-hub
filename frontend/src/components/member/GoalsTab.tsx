import { useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import type { GoalsData } from "@/lib/types";
import { formatPeriodLabel, sortPeriods } from "@/lib/utils/period";

interface GoalsTabProps {
	goalsByPeriod: Record<string, GoalsData>;
	activePeriod: string;
	onStartWizard?: (period: string) => void;
	isWizardOpen?: boolean;
}

export function GoalsTab({
	goalsByPeriod,
	activePeriod,
	onStartWizard,
	isWizardOpen,
}: GoalsTabProps) {
	const periodSet = new Set(Object.keys(goalsByPeriod));
	periodSet.add(activePeriod);
	const allPeriods = sortPeriods(Array.from(periodSet));

	const [selectedPeriod, setSelectedPeriod] = useState(activePeriod);
	const goals = goalsByPeriod[selectedPeriod] ?? null;

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-4">
					<h3 className="text-3xl font-semibold text-gray-800">半期目標</h3>
					{allPeriods.length > 1 ? (
						<select
							value={selectedPeriod}
							onChange={(e) => setSelectedPeriod(e.target.value)}
							className="text-xl border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
						>
							{allPeriods.map((p) => (
								<option key={p} value={p}>
									{formatPeriodLabel(p)}
									{p === activePeriod ? "（アクティブ）" : ""}
								</option>
							))}
						</select>
					) : (
						<span className="text-2xl text-gray-500">
							{formatPeriodLabel(selectedPeriod)}
						</span>
					)}
					{selectedPeriod === activePeriod && (
						<span className="text-lg bg-green-100 text-green-700 px-3 py-1 rounded-full border border-green-200 font-medium">
							アクティブ
						</span>
					)}
				</div>
				{onStartWizard && (
					<button
						type="button"
						disabled={isWizardOpen}
						onClick={() => onStartWizard(selectedPeriod)}
						className="text-lg bg-brand-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						目標設定ウィザード
					</button>
				)}
			</div>

			{goals ? (
				<div className="bg-white border border-gray-200 rounded-xl p-10">
					<MarkdownRenderer content={goals.rawMarkdown} />
				</div>
			) : (
				<EmptyState
					title="この期間の目標はまだ設定されていません"
					description="ウィザードから目標を作成できます"
				/>
			)}
		</div>
	);
}
