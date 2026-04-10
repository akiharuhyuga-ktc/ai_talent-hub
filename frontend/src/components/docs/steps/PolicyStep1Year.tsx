import { useEffect, useState } from "react";

type FlowMode = "continuous" | "initial";

interface PolicyStep1YearProps {
	availableYears: number[];
	onNext: (targetYear: number, flowMode: FlowMode, baseContent: string) => void;
}

export function PolicyStep1Year({
	availableYears,
	onNext,
}: PolicyStep1YearProps) {
	const latestYear =
		availableYears.length > 0 ? Math.max(...availableYears) : 2025;
	const [targetYear, setTargetYear] = useState(latestYear + 1);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [priorExists, setPriorExists] = useState<boolean | null>(null);
	const [priorContent, setPriorContent] = useState("");
	const [checking, setChecking] = useState(false);

	// Detect prior year policy whenever targetYear changes
	useEffect(() => {
		let cancelled = false;
		const priorYear = targetYear - 1;

		const checkPrior = async () => {
			setChecking(true);
			setPriorExists(null);
			setPriorContent("");
			try {
				const res = await fetch(`/api/docs?year=${priorYear}&strict=true`);
				const data = await res.json();
				if (cancelled) return;
				if (data.orgPolicy && data.orgPolicy.trim().length > 0) {
					setPriorExists(true);
					setPriorContent(data.orgPolicy);
				} else {
					setPriorExists(false);
					setPriorContent("");
				}
			} catch (_err) {
				if (!cancelled) {
					setPriorExists(false);
					setPriorContent("");
				}
			} finally {
				if (!cancelled) setChecking(false);
			}
		};

		if (targetYear >= 2021) {
			checkPrior();
		} else {
			setPriorExists(false);
			setPriorContent("");
		}

		return () => {
			cancelled = true;
		};
	}, [targetYear]);

	const validate = (): string => {
		if (targetYear < 2020) return "年度は2020以上を指定してください";
		if (targetYear > 2099) return "年度は2099以下を指定してください";
		return "";
	};

	const handleNext = async () => {
		const validationError = validate();
		if (validationError) {
			setError(validationError);
			return;
		}
		if (checking) return;
		setError("");
		setLoading(true);

		try {
			const flowMode: FlowMode = priorExists ? "continuous" : "initial";
			onNext(targetYear, flowMode, priorContent);
		} catch (_err) {
			setError("エラーが発生しました");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div>
			<h2 className="text-4xl font-bold text-gray-800 mb-3">対象年度の選択</h2>
			<p className="text-xl text-gray-500 mb-8">
				作成する年度を選択してください。前年度の方針有無に応じてフローが自動で切り替わります。
			</p>

			<div className="space-y-8">
				{/* Target year input */}
				<div>
					<label className="block text-xl font-medium text-gray-700 mb-2">
						作成する年度
					</label>
					<input
						type="number"
						value={targetYear}
						onChange={(e) => {
							setTargetYear(Number(e.target.value));
							setError("");
						}}
						min={2020}
						max={2099}
						className="w-48 border border-gray-200 rounded-xl bg-[#fafbfc] px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-brand-400"
					/>
					<span className="text-xl text-gray-500 ml-3">年度</span>
				</div>

				{/* Flow detection indicator */}
				{checking && (
					<div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
						<p className="text-xl text-gray-500">前年度の方針を確認中...</p>
					</div>
				)}

				{!checking && priorExists === true && (
					<div className="bg-green-50 border border-green-300 rounded-lg p-6">
						<p className="text-xl text-green-800">
							前年度（{targetYear - 1}年度）の方針をベースに更新します
						</p>
						<p className="text-lg text-green-600 mt-1">
							継続モード: 前年度の振り返りから始めます
						</p>
					</div>
				)}

				{!checking && priorExists === false && (
					<div className="bg-amber-50 border border-amber-300 rounded-lg p-6">
						<p className="text-xl text-amber-800">
							組織方針が未登録のため、ゼロから方針を作成します
						</p>
						<p className="text-lg text-amber-600 mt-1">
							初期モード: 組織の現状把握から始めます
						</p>
					</div>
				)}

				{/* Error */}
				{error && (
					<p className="text-xl text-red-600 bg-red-50 border border-red-200 rounded-lg px-5 py-3">
						{error}
					</p>
				)}

				{/* Next button */}
				<div className="flex justify-end">
					<button
						type="button"
						onClick={handleNext}
						disabled={loading || checking || priorExists === null}
						className="px-10 py-3.5 text-xl bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-glow disabled:opacity-40 disabled:cursor-not-allowed"
					>
						{loading ? "読み込み中..." : "次へ進む"}
					</button>
				</div>
			</div>
		</div>
	);
}
