import { useState } from "react";
import type { ManagerInput } from "@/lib/types";

interface Props {
	initial: ManagerInput;
	memberName: string;
	onNext: (data: ManagerInput) => void;
	onBack: () => void;
}

export function Step2ManagerInput({
	initial,
	memberName,
	onNext,
	onBack,
}: Props) {
	const [form, setForm] = useState<ManagerInput>(initial);

	const isValid = form.expectations.trim() && form.biggestChallenge.trim();

	return (
		<div>
			<h2 className="text-4xl font-bold text-gray-800 mb-3">
				マネージャーインプット
			</h2>
			<p className="text-xl text-gray-500 mb-8">
				{memberName}さんに対する期待と課題認識を入力してください。
			</p>

			<div className="space-y-6 mb-10">
				<div>
					<label
						htmlFor="expectations"
						className="block text-xl font-medium text-gray-700 mb-2"
					>
						このメンバーへの期待 <span className="text-red-500">*</span>
					</label>
					<textarea
						id="expectations"
						value={form.expectations}
						onChange={(e) => setForm({ ...form, expectations: e.target.value })}
						rows={6}
						placeholder="来期に期待する役割・成果・成長の方向性を具体的に記入してください"
						className="w-full border border-gray-200 rounded-xl bg-[#fafbfc] px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
					/>
				</div>
				<div>
					<label
						htmlFor="biggestChallenge"
						className="block text-xl font-medium text-gray-700 mb-2"
					>
						このメンバーの最大の課題（一言で）{" "}
						<span className="text-red-500">*</span>
					</label>
					<input
						id="biggestChallenge"
						type="text"
						value={form.biggestChallenge}
						onChange={(e) =>
							setForm({ ...form, biggestChallenge: e.target.value })
						}
						placeholder="例：個人作業から脱却し、チーム全体をリードする動きへの転換"
						className="w-full border border-gray-200 rounded-xl bg-[#fafbfc] px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-brand-400"
					/>
				</div>
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
					onClick={() => onNext(form)}
					disabled={!isValid}
					className="px-10 py-3.5 text-xl bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-glow disabled:opacity-40 disabled:cursor-not-allowed"
				>
					次へ進む
				</button>
			</div>
		</div>
	);
}
