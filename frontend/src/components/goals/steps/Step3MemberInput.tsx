import { useState } from "react";
import type { MemberInput } from "@/lib/types";

interface Props {
	initial: MemberInput;
	memberName: string;
	onNext: (data: MemberInput) => void;
	onBack: () => void;
}

export function Step3MemberInput({
	initial,
	memberName,
	onNext,
	onBack,
}: Props) {
	const [form, setForm] = useState<MemberInput>(initial);

	const isValid =
		form.growthArea.trim() &&
		form.currentDifficulties.trim() &&
		form.oneYearVision.trim();

	return (
		<div>
			<h2 className="text-4xl font-bold text-gray-800 mb-3">
				メンバー本人の意見
			</h2>
			<p className="text-xl text-gray-500 mb-1">
				{memberName}さんへのヒアリング内容を入力してください。
			</p>
			<p className="text-lg text-gray-400 mb-8">
				※ 1on1等でメンバーから聞き取った内容をマネージャーが代入力します。
			</p>

			<div className="space-y-6 mb-10">
				<div>
					<label
						htmlFor="growthArea"
						className="block text-xl font-medium text-gray-700 mb-2"
					>
						今期最も成長したいスキル・領域{" "}
						<span className="text-red-500">*</span>
					</label>
					<textarea
						id="growthArea"
						value={form.growthArea}
						onChange={(e) => setForm({ ...form, growthArea: e.target.value })}
						rows={5}
						placeholder="例：チームマネジメント力、クロスプラットフォーム技術の深化など"
						className="w-full border border-gray-200 rounded-xl bg-[#fafbfc] px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
					/>
				</div>
				<div>
					<label
						htmlFor="currentDifficulties"
						className="block text-xl font-medium text-gray-700 mb-2"
					>
						現在の業務で困っていること・非効率だと感じること{" "}
						<span className="text-red-500">*</span>
					</label>
					<textarea
						id="currentDifficulties"
						value={form.currentDifficulties}
						onChange={(e) =>
							setForm({ ...form, currentDifficulties: e.target.value })
						}
						rows={5}
						placeholder="例：レビューの待ち時間が長い、仕様の認識齟齬が頻発するなど"
						className="w-full border border-gray-200 rounded-xl bg-[#fafbfc] px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
					/>
				</div>
				<div>
					<label
						htmlFor="oneYearVision"
						className="block text-xl font-medium text-gray-700 mb-2"
					>
						1年後になりたい姿（自由記述）{" "}
						<span className="text-red-500">*</span>
					</label>
					<textarea
						id="oneYearVision"
						value={form.oneYearVision}
						onChange={(e) =>
							setForm({ ...form, oneYearVision: e.target.value })
						}
						rows={5}
						placeholder="例：テックリードとしてチームの技術方針を決められる存在になりたい"
						className="w-full border border-gray-200 rounded-xl bg-[#fafbfc] px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
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
