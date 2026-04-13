import { useEffect, useRef, useState } from "react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import type { GoalWizardState, WizardContextData } from "@/lib/types";

interface Props {
	state: GoalWizardState;
	context: WizardContextData;
	onGenerated: (goals: string) => void;
	onBack: () => void;
}

export function Step6GoalGeneration({
	state,
	context,
	onGenerated,
	onBack,
}: Props) {
	const [goals, setGoals] = useState(state.generatedGoals || "");
	const [isStreaming, setIsStreaming] = useState(!state.generatedGoals);
	const [error, setError] = useState("");
	const abortRef = useRef<AbortController | null>(null);

	useEffect(() => {
		if (state.generatedGoals) return;

		const controller = new AbortController();
		abortRef.current = controller;

		(async () => {
			setIsStreaming(true);
			setError("");
			try {
				const res = await fetch(
					`/api/members/${context.memberName}/goals/generate`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							memberContext: context.memberProfile,
							managerInput: state.managerInput,
							memberInput: state.memberInput,
							previousPeriod: state.previousPeriod.previousGoals
								? state.previousPeriod
								: undefined,
							diagnosis: state.diagnosis,
						}),
						signal: controller.signal,
					},
				);

				if (
					!res.ok ||
					!res.headers.get("content-type")?.includes("text/event-stream")
				) {
					setError("目標の生成に失敗しました");
					setIsStreaming(false);
					return;
				}

				const reader = res.body?.getReader();
				if (!reader) {
					setError("目標の生成に失敗しました");
					setIsStreaming(false);
					return;
				}
				const decoder = new TextDecoder();
				let buffer = "";
				let fullText = "";

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
							if (parsed.text) {
								fullText += parsed.text;
								setGoals(fullText);
							}
						} catch (_err) {
							/* ignore parse errors */
						}
					}
				}
			} catch (err) {
				if ((err as Error).name !== "AbortError") {
					setError("目標の生成に失敗しました");
				}
			} finally {
				setIsStreaming(false);
			}
		})();

		return () => {
			controller.abort();
		};
	}, [
		state.generatedGoals,
		state.managerInput,
		state.memberInput,
		state.previousPeriod,
		state.diagnosis,
		context.memberName,
		context.memberProfile,
	]);

	if (!goals && isStreaming) {
		return (
			<div className="flex flex-col items-center justify-center py-20">
				<div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-5" />
				<p className="text-xl text-gray-500">AIが目標を設計しています...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="text-center py-16">
				<p className="text-xl text-red-500 mb-5">{error}</p>
				<button
					type="button"
					onClick={onBack}
					className="px-8 py-3 text-xl border border-gray-200 rounded-xl hover:bg-gray-50"
				>
					戻る
				</button>
			</div>
		);
	}

	return (
		<div>
			<h2 className="text-4xl font-bold text-gray-800 mb-3">目標案</h2>
			<p className="text-xl text-gray-500 mb-8">
				{isStreaming
					? "AIが目標を生成中..."
					: "診断サマリーとインプットをもとにAIが目標を設計しました。次のステップで壁打ち・精緻化ができます。"}
			</p>

			<div className="bg-white border border-gray-200 rounded-lg p-8 mb-8">
				<MarkdownRenderer content={goals} />
				{isStreaming && (
					<span className="inline-block w-2 h-5 bg-brand-500 animate-pulse ml-1" />
				)}
			</div>

			{!isStreaming && (
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
						onClick={() => onGenerated(goals)}
						className="px-10 py-3.5 text-xl bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-glow"
					>
						壁打ちへ進む
					</button>
				</div>
			)}
		</div>
	);
}
