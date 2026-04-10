import { useState } from "react";

interface PolicyStep3BUpperPolicyProps {
	onNext: (upperOrgPolicy: string) => void;
	onBack: () => void;
}

export function PolicyStep3BUpperPolicy({
	onNext,
	onBack,
}: PolicyStep3BUpperPolicyProps) {
	const [upperPolicy, setUpperPolicy] = useState("");

	return (
		<div>
			<h2 className="text-4xl font-bold text-gray-800 mb-3">上位組織の方針</h2>
			<p className="text-xl text-gray-500 mb-8">
				上位組織（本部・事業部など）の方針があれば入力してください
			</p>

			<div className="space-y-6">
				<div>
					<label className="block text-xl font-medium text-gray-700 mb-2">
						上位組織の方針{" "}
						<span className="text-lg text-gray-400 font-normal ml-2">
							（任意）
						</span>
					</label>
					<p className="text-lg text-gray-500 mb-3">
						入力があるとAIの提案精度が大幅に上がります
					</p>
					<textarea
						value={upperPolicy}
						onChange={(e) => setUpperPolicy(e.target.value)}
						rows={8}
						placeholder="例: 本部方針のキーワード、重点施策、中期経営計画の抜粋など"
						className="w-full border border-gray-200 rounded-xl bg-[#fafbfc] px-5 py-4 text-xl resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
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
						onClick={() => onNext(upperPolicy.trim())}
						className="px-10 py-3.5 text-xl bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-glow"
					>
						次へ進む
					</button>
				</div>
			</div>
		</div>
	);
}
