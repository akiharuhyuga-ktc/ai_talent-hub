import { useState } from "react";
import type { ConditionScore } from "@/lib/types";

const SLIDER_LABELS: {
	key: keyof Pick<ConditionScore, "motivation" | "workload" | "teamRelations">;
	label: string;
	descriptions: string[];
}[] = [
	{
		key: "motivation",
		label: "モチベーション",
		descriptions: ["非常に低い", "やや低い", "普通", "やや高い", "非常に高い"],
	},
	{
		key: "workload",
		label: "業務負荷",
		descriptions: ["非常に軽い", "やや軽い", "適正", "やや重い", "非常に重い"],
	},
	{
		key: "teamRelations",
		label: "チーム関係性",
		descriptions: ["非常に悪い", "やや悪い", "普通", "やや良い", "非常に良い"],
	},
];

interface Props {
	initial: ConditionScore;
	previousCondition: ConditionScore | null;
	onNext: (condition: ConditionScore) => void;
	onBack: () => void;
}

export function OOStep3Condition({
	initial,
	previousCondition,
	onNext,
	onBack,
}: Props) {
	const [condition, setCondition] = useState<ConditionScore>(initial);
	const [touched, setTouched] = useState({
		motivation: initial.motivation !== null,
		workload: initial.workload !== null,
		teamRelations: initial.teamRelations !== null,
	});

	const allTouched =
		touched.motivation && touched.workload && touched.teamRelations;

	const handleSliderChange = (
		key: "motivation" | "workload" | "teamRelations",
		value: number,
	) => {
		setCondition({ ...condition, [key]: value });
		setTouched({ ...touched, [key]: true });
	};

	const getTrendEmoji = (key: "motivation" | "workload" | "teamRelations") => {
		if (
			!previousCondition ||
			previousCondition[key] === null ||
			condition[key] === null
		)
			return null;
		const prev = previousCondition[key] as number;
		const curr = condition[key] as number;
		const diff = curr - prev;

		if (key === "workload") {
			// For workload, higher means heavier (negative trend)
			if (diff >= 2)
				return {
					emoji: "!!",
					color: "text-red-600",
					label: `前回${prev} → 今回${curr}（大幅増加）`,
				};
			if (diff === 1)
				return {
					emoji: "!",
					color: "text-amber-600",
					label: `前回${prev} → 今回${curr}（増加）`,
				};
			if (diff <= -2)
				return {
					emoji: "++",
					color: "text-green-600",
					label: `前回${prev} → 今回${curr}（大幅軽減）`,
				};
			if (diff === -1)
				return {
					emoji: "+",
					color: "text-green-600",
					label: `前回${prev} → 今回${curr}（軽減）`,
				};
			return {
				emoji: "=",
				color: "text-gray-500",
				label: `前回${prev} → 今回${curr}（変化なし）`,
			};
		}
		// For motivation and teamRelations, lower is negative trend
		if (diff <= -2)
			return {
				emoji: "!!",
				color: "text-red-600",
				label: `前回${prev} → 今回${curr}（大幅低下）`,
			};
		if (diff === -1)
			return {
				emoji: "!",
				color: "text-amber-600",
				label: `前回${prev} → 今回${curr}（低下）`,
			};
		if (diff >= 2)
			return {
				emoji: "++",
				color: "text-green-600",
				label: `前回${prev} → 今回${curr}（大幅改善）`,
			};
		if (diff === 1)
			return {
				emoji: "+",
				color: "text-green-600",
				label: `前回${prev} → 今回${curr}（改善）`,
			};
		return {
			emoji: "=",
			color: "text-gray-500",
			label: `前回${prev} → 今回${curr}（変化なし）`,
		};
	};

	return (
		<div>
			<h2 className="text-4xl font-bold text-gray-800 mb-3">コンディション</h2>
			<p className="text-xl text-gray-500 mb-8">
				メンバーの現在のコンディションを1〜5で評価してください。
			</p>

			<div className="space-y-8 mb-10">
				{SLIDER_LABELS.map(({ key, label, descriptions }) => {
					const value = condition[key];
					const displayValue = touched[key] ? (value as number) : 3;
					const trend = allTouched ? getTrendEmoji(key) : null;

					return (
						<div
							key={key}
							className="bg-gray-50 border border-gray-200 rounded-lg p-6"
						>
							<div className="flex items-center justify-between mb-4">
								<label className="text-xl font-medium text-gray-700">
									{label}
								</label>
								<div className="flex items-center gap-3">
									{touched[key] ? (
										<span className="text-xl font-bold text-brand-600">
											{value}
										</span>
									) : (
										<span className="text-lg text-gray-400">未選択</span>
									)}
								</div>
							</div>

							<div className="mb-2">
								<input
									type="range"
									min={1}
									max={5}
									step={1}
									value={displayValue}
									onChange={(e) =>
										handleSliderChange(key, Number.parseInt(e.target.value, 10))
									}
									onMouseDown={() => {
										if (!touched[key]) handleSliderChange(key, displayValue);
									}}
									onTouchStart={() => {
										if (!touched[key]) handleSliderChange(key, displayValue);
									}}
									className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
								/>
								<div className="flex justify-between mt-1">
									{descriptions.map((desc, i) => (
										<span
											key={i}
											className="text-lg text-gray-400 w-[20%] text-center"
										>
											{desc}
										</span>
									))}
								</div>
							</div>

							{trend && (
								<div
									className={`mt-3 text-lg ${trend.color} bg-white border rounded-lg px-4 py-2`}
								>
									<span className="font-semibold mr-2">{trend.emoji}</span>
									{trend.label}
								</div>
							)}
						</div>
					);
				})}
			</div>

			<div className="mb-10">
				<label className="block text-xl font-medium text-gray-700 mb-2">
					コメント（任意）
				</label>
				<textarea
					value={condition.comment}
					onChange={(e) =>
						setCondition({ ...condition, comment: e.target.value })
					}
					rows={5}
					placeholder="コンディションについて補足があれば入力してください"
					className="w-full border border-gray-200 rounded-xl bg-[#fafbfc] px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
				/>
			</div>

			<div className="flex justify-end gap-4">
				<button
					type="button"
					onClick={onBack}
					className="px-10 py-3.5 text-xl border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
				>
					戻る
				</button>
				<button
					type="button"
					onClick={() => onNext(condition)}
					disabled={!allTouched}
					className="px-10 py-3.5 text-xl bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-glow disabled:opacity-40 disabled:cursor-not-allowed"
				>
					次へ進む
				</button>
			</div>
		</div>
	);
}
