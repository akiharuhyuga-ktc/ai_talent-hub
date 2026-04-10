import { useEffect, useRef, useState } from "react";
import type {
	EvaluationDraft,
	EvaluationGrade,
	EvaluationWizardContextData,
	EvaluationWizardState,
} from "@/lib/types";

const gradeColorMap: Record<
	string,
	{ bg: string; text: string; border: string }
> = {
	S: {
		bg: "bg-amber-50",
		text: "text-amber-700",
		border: "border-amber-300",
	},
	A: {
		bg: "bg-blue-50",
		text: "text-blue-700",
		border: "border-blue-300",
	},
	B: {
		bg: "bg-gray-50",
		text: "text-gray-600",
		border: "border-gray-300",
	},
	C: {
		bg: "bg-red-50",
		text: "text-red-600",
		border: "border-red-300",
	},
	D: {
		bg: "bg-red-50",
		text: "text-red-600",
		border: "border-red-300",
	},
};

function GradeBadge({
	grade,
	size = "normal",
}: {
	grade: EvaluationGrade | "";
	size?: "normal" | "large";
}) {
	if (!grade) return null;
	const colors = gradeColorMap[grade] || gradeColorMap.B;
	const sizeClasses =
		size === "large" ? "w-16 h-16 text-3xl" : "w-10 h-10 text-xl";
	return (
		<span
			className={`inline-flex items-center justify-center rounded-xl font-bold border-2 ${sizeClasses} ${colors.bg} ${colors.text} ${colors.border}`}
		>
			{grade}
		</span>
	);
}

interface Props {
	state: EvaluationWizardState;
	context: EvaluationWizardContextData;
	onDraftGenerated: (draft: EvaluationDraft) => void;
	onBack: () => void;
}

export function EvalStep2AIDraft({
	state,
	context,
	onDraftGenerated,
	onBack,
}: Props) {
	const [streaming, setStreaming] = useState(false);
	const [error, setError] = useState("");
	const [draft, setDraft] = useState<EvaluationDraft | null>(state.aiDraft);
	const [streamingText, setStreamingText] = useState("");
	const abortRef = useRef<AbortController | null>(null);

	useEffect(() => {
		if (state.aiDraft) {
			setDraft(state.aiDraft);
			return;
		}

		const controller = new AbortController();
		abortRef.current = controller;

		(async () => {
			setStreaming(true);
			setError("");
			setStreamingText("");
			try {
				const oneOnOneSummaries = context.oneOnOneRecords
					.map((r) => r.rawMarkdown)
					.join("\n\n---\n\n");

				const res = await fetch(
					`/api/members/${context.memberName}/reviews/draft`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							memberProfile: context.memberProfile,
							orgPolicy: context.orgPolicy,
							evaluationCriteria: context.evaluationCriteria,
							guidelines: context.guidelines,
							goalsRawMarkdown: context.goalsRawMarkdown,
							oneOnOneSummaries,
							previousReview: context.previousReview,
							selfEvaluation: state.selfEvaluation,
							managerSupplementary: state.managerSupplementary,
						}),
						signal: controller.signal,
					},
				);

				if (res.status === 503) {
					setError(
						"API未設定のためAI評価を生成できません。手動で評価を入力してください。",
					);
					setStreaming(false);
					return;
				}

				if (!res.ok) {
					setError("AI評価の生成に失敗しました。もう一度お試しください。");
					setStreaming(false);
					return;
				}

				const reader = res.body?.getReader();
				if (!reader) {
					setError("AI評価の生成に失敗しました。もう一度お試しください。");
					setStreaming(false);
					return;
				}
				const decoder = new TextDecoder();
				let buffer = "";
				let fullText = "";
				let receivedDraft = false;

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split("\n");
					buffer = lines.pop() || "";

					for (const line of lines) {
						if (!line.startsWith("data: ")) continue;
						const data = line.slice(6).trim();
						if (data === "[DONE]") continue;
						try {
							const parsed = JSON.parse(data);
							if (parsed.draft) {
								// final イベント: パース済みドラフトを受信
								receivedDraft = true;
								setDraft(parsed.draft as EvaluationDraft);
							} else if (parsed.text) {
								fullText += parsed.text;
								setStreamingText(fullText);
							}
						} catch (_err) {
							/* ignore parse errors */
						}
					}
				}

				if (!receivedDraft) {
					setError("AI評価の生成に失敗しました。");
				}
			} catch (err) {
				if ((err as Error).name === "AbortError") return;
				setError(
					"AI評価の生成に失敗しました。ネットワーク接続を確認してください。",
				);
			} finally {
				setStreaming(false);
				abortRef.current = null;
			}
		})();

		return () => {
			controller.abort();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		state.aiDraft,
		context.evaluationCriteria,
		context.goalsRawMarkdown,
		context.guidelines,
		context.memberName,
		context.memberProfile,
		context.oneOnOneRecords.map,
		context.orgPolicy,
		context.previousReview,
		state.managerSupplementary,
		state.selfEvaluation,
	]);

	const showDraft = draft && !streaming;

	return (
		<div>
			<h2 className="text-4xl font-bold text-gray-800 mb-3">AI評価ドラフト</h2>
			<p className="text-xl text-gray-500 mb-8">
				収集した情報をもとにAIが評価ドラフトを生成しました。
			</p>

			{streaming && (
				<div className="mb-8">
					<div className="flex items-center gap-3 mb-4">
						<div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
						<p className="text-lg text-gray-500">
							AIが評価ドラフトを生成しています...
						</p>
					</div>
					{streamingText && (
						<div className="bg-gray-50 border border-gray-200 rounded-lg p-6 max-h-[400px] overflow-y-auto">
							<pre className="whitespace-pre-wrap text-sm text-gray-600 font-mono leading-relaxed">
								{streamingText}
							</pre>
							<span className="inline-block w-2 h-5 bg-brand-500 animate-pulse ml-1" />
						</div>
					)}
				</div>
			)}

			{error && (
				<div className="bg-red-50 border border-red-200 rounded-lg p-5 mb-8">
					<p className="text-xl text-red-600">{error}</p>
				</div>
			)}

			{showDraft && (
				<div className="space-y-8 mb-10">
					{/* Goal evaluations */}
					<div>
						<h3 className="text-xl font-medium text-gray-700 mb-4">
							目標別評価
						</h3>
						<div className="space-y-4">
							{draft.goalEvaluations.map((ge) => (
								<div
									key={ge.goalLabel}
									className="bg-gray-50 border border-gray-200 rounded-lg p-6"
								>
									<div className="flex items-center gap-4 mb-3">
										<GradeBadge grade={ge.grade as EvaluationGrade} />
										<h4 className="text-xl font-medium text-gray-800">
											{ge.goalLabel}
										</h4>
									</div>
									<p className="text-xl text-gray-600 leading-relaxed">
										{ge.rationale}
									</p>
								</div>
							))}
						</div>
					</div>

					{/* Overall grade */}
					<div className="bg-brand-50 border border-brand-200 rounded-lg p-6">
						<div className="flex items-center gap-4 mb-3">
							<h3 className="text-xl font-medium text-gray-700">総合評価</h3>
							<GradeBadge
								grade={draft.overallGrade as EvaluationGrade}
								size="large"
							/>
						</div>
						<p className="text-xl text-gray-600 leading-relaxed">
							{draft.overallRationale}
						</p>
					</div>

					{/* Self-eval gap */}
					{draft.selfEvalGap && (
						<div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
							<h3 className="text-xl font-medium text-amber-700 mb-3">
								自己評価との乖離分析
							</h3>
							<p className="text-xl text-gray-700 leading-relaxed">
								{draft.selfEvalGap}
							</p>
						</div>
					)}

					{/* Special notes */}
					{draft.specialNotes && (
						<div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
							<h3 className="text-xl font-medium text-blue-700 mb-3">
								特記事項
							</h3>
							<p className="text-xl text-gray-700 leading-relaxed">
								{draft.specialNotes}
							</p>
						</div>
					)}
				</div>
			)}

			{/* Buttons */}
			<div className="flex justify-end gap-4">
				<button
					type="button"
					onClick={onBack}
					className="px-10 py-3.5 text-xl border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
				>
					戻る
				</button>
				{showDraft && (
					<button
						type="button"
						onClick={() => onDraftGenerated(draft)}
						className="px-10 py-3.5 text-xl bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-glow"
					>
						確認・修正へ進む
					</button>
				)}
			</div>
		</div>
	);
}
