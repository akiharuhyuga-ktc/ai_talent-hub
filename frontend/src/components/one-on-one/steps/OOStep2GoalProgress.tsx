import { useState } from "react";
import type { GoalProgressEntry } from "@/lib/types";

const STATUS_OPTIONS = [
	{ value: "", label: "-- 選択してください --" },
	{ value: "on-track", label: "順調" },
	{ value: "at-risk", label: "要注意" },
	{ value: "delayed", label: "遅延" },
];

interface Props {
	goalProgress: GoalProgressEntry[];
	onNext: (progress: GoalProgressEntry[]) => void;
	onBack: () => void;
}

export function OOStep2GoalProgress({ goalProgress, onNext, onBack }: Props) {
	const hasGoals = goalProgress.length > 0;
	const [progress, setProgress] = useState<GoalProgressEntry[]>(goalProgress);
	const [freeText, setFreeText] = useState("");

	const updateProgress = (
		index: number,
		field: keyof GoalProgressEntry,
		value: string,
	) => {
		const updated = [...progress];
		updated[index] = { ...updated[index], [field]: value };
		setProgress(updated);
	};

	const isValid = hasGoals
		? progress.every((p) => p.status !== "" && p.progressComment.trim() !== "")
		: freeText.trim() !== "";

	const handleNext = () => {
		if (hasGoals) {
			onNext(progress);
		} else {
			onNext([
				{
					goalLabel: "自由記述",
					goalText: "",
					achievedState: "",
					milestone: "",
					verificationMethod: "",
					status: "on-track",
					progressComment: freeText,
				},
			]);
		}
	};

	return (
		<div>
			<h2 className="text-4xl font-bold text-gray-800 mb-3">目標進捗</h2>
			<p className="text-xl text-gray-500 mb-8">
				各目標の進捗状況を入力してください。
			</p>

			{hasGoals ? (
				<div className="space-y-6 mb-10">
					{progress.map((entry, i) => (
						<div
							key={i}
							className="bg-gray-50 border border-gray-200 rounded-lg p-6"
						>
							<div className="mb-4">
								<h3 className="text-xl font-medium text-gray-800 mb-2">
									{entry.goalLabel}
								</h3>
								<p className="text-lg text-gray-600 mb-2">{entry.goalText}</p>
								{entry.achievedState && (
									<p className="text-lg text-gray-500">
										<span className="font-medium">達成状態：</span>
										{entry.achievedState}
									</p>
								)}
								{entry.milestone && (
									<p className="text-lg text-gray-500">
										<span className="font-medium">マイルストーン：</span>
										{entry.milestone}
									</p>
								)}
							</div>

							<div className="mb-4">
								<label className="block text-xl font-medium text-gray-700 mb-2">
									進捗ステータス <span className="text-red-500">*</span>
								</label>
								<select
									value={entry.status}
									onChange={(e) => updateProgress(i, "status", e.target.value)}
									className="w-full border border-gray-200 rounded-xl px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-brand-400 bg-[#fafbfc]"
								>
									{STATUS_OPTIONS.map((opt) => (
										<option key={opt.value} value={opt.value}>
											{opt.label}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className="block text-xl font-medium text-gray-700 mb-2">
									進捗コメント <span className="text-red-500">*</span>
								</label>
								<textarea
									value={entry.progressComment}
									onChange={(e) =>
										updateProgress(i, "progressComment", e.target.value)
									}
									rows={5}
									placeholder="具体的な進捗状況や課題を入力してください"
									className="w-full border border-gray-200 rounded-xl bg-[#fafbfc] px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
								/>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="mb-10">
					<div className="bg-amber-50 border border-amber-200 rounded-lg p-5 mb-6">
						<p className="text-xl text-amber-700">
							目標が未設定です。自由記述で進捗を記録してください。
						</p>
					</div>
					<div>
						<label className="block text-xl font-medium text-gray-700 mb-2">
							進捗メモ <span className="text-red-500">*</span>
						</label>
						<textarea
							value={freeText}
							onChange={(e) => setFreeText(e.target.value)}
							rows={6}
							placeholder="現在の業務状況や進捗について自由に記入してください"
							className="w-full border border-gray-200 rounded-xl bg-[#fafbfc] px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
						/>
					</div>
				</div>
			)}

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
					onClick={handleNext}
					disabled={!isValid}
					className="px-10 py-3.5 text-xl bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-glow disabled:opacity-40 disabled:cursor-not-allowed"
				>
					次へ進む
				</button>
			</div>
		</div>
	);
}
