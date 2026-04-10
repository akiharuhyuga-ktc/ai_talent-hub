import { Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import {
	mergeGoalSections,
	parseGoalsToSections,
	stripGoalHeading,
} from "@/lib/parsers/goals";
import type {
	ChatMessage,
	GoalWizardState,
	WizardContextData,
} from "@/lib/types";

interface Props {
	state: GoalWizardState;
	context: WizardContextData;
	onAddRefinement: (
		messages: ChatMessage[],
		newGoals: string,
		count: number,
	) => void;
	onConfirm: (goals: string) => void;
	onBack: () => void;
}

export function Step7Refinement({
	state,
	context,
	onAddRefinement,
	onConfirm,
	onBack,
}: Props) {
	const [feedback, setFeedback] = useState("");
	const [currentGoals, setCurrentGoals] = useState(state.generatedGoals || "");
	const [isStreaming, setIsStreaming] = useState(false);
	const [streamingLabels, setStreamingLabels] = useState<Set<string>>(
		new Set(),
	);
	const [count, setCount] = useState(state.refinementCount);
	const [messages, setMessages] = useState<ChatMessage[]>(
		state.refinementMessages,
	);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [saveError, setSaveError] = useState("");
	const abortRef = useRef<AbortController | null>(null);

	const parsed = useMemo(
		() => parseGoalsToSections(currentGoals),
		[currentGoals],
	);

	const [selectedLabels, setSelectedLabels] = useState<Set<string>>(
		() => new Set(parsed.goals.map((g) => g.label)),
	);

	const toggleLabel = (label: string) => {
		setSelectedLabels((prev) => {
			const next = new Set(prev);
			if (next.has(label)) next.delete(label);
			else next.add(label);
			return next;
		});
	};

	const handleDeleteGoal = (label: string) => {
		const goalTitle = parsed.goals.find((g) => g.label === label)?.title || "";
		if (!confirm(`目標${label}「${goalTitle}」を削除しますか？`)) return;
		const remaining = parsed.goals.filter((g) => g.label !== label);
		const newContent = mergeGoalSections(remaining, parsed.footer);
		setCurrentGoals(newContent);
		setSelectedLabels((prev) => {
			const next = new Set(prev);
			next.delete(label);
			return next;
		});
	};

	const handleSendFeedback = async () => {
		if (!feedback.trim() || isStreaming || selectedLabels.size === 0) return;

		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		setIsStreaming(true);
		setStreamingLabels(new Set(selectedLabels));

		const newMessages: ChatMessage[] = [
			...messages,
			{ role: "assistant" as const, content: currentGoals },
			{ role: "user" as const, content: feedback },
		];

		const selectedArray = Array.from(selectedLabels);
		const isPartial = selectedArray.length < parsed.goals.length;

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
						refinementMessages: newMessages,
						...(isPartial
							? {
									targetGoalLabels: selectedArray,
									allGoalsMarkdown: currentGoals,
								}
							: {}),
					}),
					signal: controller.signal,
				},
			);

			if (
				!res.ok ||
				!res.headers.get("content-type")?.includes("text/event-stream")
			) {
				setIsStreaming(false);
				setStreamingLabels(new Set());
				return;
			}

			const reader = res.body?.getReader();
			if (!reader) {
				setIsStreaming(false);
				setStreamingLabels(new Set());
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
						const j = JSON.parse(data);
						if (j.text) fullText += j.text;
					} catch (_err) {
						/* ignore parse errors */
					}
				}
			}

			if (fullText) {
				let mergedGoals: string;
				if (isPartial) {
					const aiParsed = parseGoalsToSections(fullText);
					const aiGoalMap = new Map(aiParsed.goals.map((g) => [g.label, g]));
					const mergedGoalsList = parsed.goals.map(
						(g) => aiGoalMap.get(g.label) ?? g,
					);
					const newFooter = aiParsed.footer || parsed.footer;
					mergedGoals = mergeGoalSections(mergedGoalsList, newFooter);
				} else {
					mergedGoals = fullText;
				}

				setCurrentGoals(mergedGoals);
				const newCount = count + 1;
				setMessages(newMessages);
				setCount(newCount);
				setFeedback("");
				onAddRefinement(newMessages, mergedGoals, newCount);
			}
		} catch (err) {
			if ((err as Error).name === "AbortError") return;
		} finally {
			setIsStreaming(false);
			setStreamingLabels(new Set());
			abortRef.current = null;
		}
	};

	const handleConfirm = async () => {
		setSaving(true);
		setSaveError("");
		try {
			const bodyContent = mergeGoalSections(parsed.goals, parsed.footer);
			const res = await fetch(`/api/members/${context.memberName}/goals`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					content: bodyContent,
					period: context.targetPeriod,
				}),
			});
			if (!res.ok) throw new Error("保存に失敗しました");
			setSaved(true);
			onConfirm(currentGoals);
		} catch (_err) {
			setSaveError("目標の保存に失敗しました。再度お試しください。");
		} finally {
			setSaving(false);
		}
	};

	return (
		<div>
			<h2 className="text-4xl font-bold text-gray-800 mb-3">壁打ち・精緻化</h2>
			<p className="text-xl text-gray-500 mb-5">
				ブラッシュアップしたい目標にチェックを入れ、フィードバックを入力してください。
				<span className="ml-2 text-lg bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
					フィードバック: {count}/2回目
				</span>
			</p>

			<div className="space-y-4 mb-8">
				{parsed.goals.length > 0 ? (
					parsed.goals.map((goal) => {
						const isTarget = streamingLabels.has(goal.label);
						return (
							<div
								key={goal.label}
								className="bg-white border border-gray-200 rounded-lg overflow-hidden"
							>
								<div className="flex items-center gap-3 px-6 py-3 bg-gray-50 border-b border-gray-100">
									<input
										type="checkbox"
										checked={selectedLabels.has(goal.label)}
										onChange={() => toggleLabel(goal.label)}
										disabled={isStreaming}
										className="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
									/>
									<span className="text-lg font-semibold text-gray-700 flex-1">
										目標{goal.label}（{goal.type}）：
										{goal.title}
									</span>
									{parsed.goals.length > 1 && !isStreaming && (
										<button
											type="button"
											onClick={() => handleDeleteGoal(goal.label)}
											className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
											title="この目標を削除"
										>
											<Trash2 size={16} />
										</button>
									)}
								</div>
								<div className="px-8 py-4 max-h-[350px] overflow-y-auto">
									{isTarget && isStreaming ? (
										<div className="flex items-center gap-3 text-brand-500 py-8 justify-center">
											<div className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
											<span className="text-lg">再生成中...</span>
										</div>
									) : (
										<MarkdownRenderer
											content={stripGoalHeading(goal.content)}
										/>
									)}
								</div>
							</div>
						);
					})
				) : (
					<div className="bg-white border border-gray-200 rounded-lg p-8 max-h-[500px] overflow-y-auto">
						<MarkdownRenderer content={currentGoals} />
						{isStreaming && (
							<span className="inline-block w-2 h-5 bg-brand-500 animate-pulse ml-1" />
						)}
					</div>
				)}

				{parsed.footer.trim() && (
					<div className="bg-white border border-gray-200 rounded-lg p-8">
						<MarkdownRenderer content={parsed.footer} />
					</div>
				)}
			</div>

			{saveError && (
				<div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
					{saveError}
				</div>
			)}

			{saved ? (
				<div className="text-center py-8">
					<div className="inline-flex items-center gap-2 text-xl text-green-600 bg-green-50 border border-green-200 rounded-lg px-8 py-4 font-semibold">
						<svg
							className="w-6 h-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							role="img"
							aria-label="チェックマーク"
						>
							<title>チェックマーク</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M5 13l4 4L19 7"
							/>
						</svg>
						目標として保存しました
					</div>
					<p className="text-lg text-gray-400 mt-4">
						「目標」タブに反映されています。ウィザードを閉じてください。
					</p>
				</div>
			) : (
				<>
					{count < 2 && (
						<div className="mb-8">
							<label
								htmlFor="refinement-feedback"
								className="block text-xl font-medium text-gray-700 mb-2"
							>
								フィードバック
							</label>
							<div className="flex justify-end gap-4">
								<textarea
									id="refinement-feedback"
									value={feedback}
									onChange={(e) => setFeedback(e.target.value)}
									rows={5}
									placeholder="修正してほしい点やもっと具体的にしたい部分を入力してください"
									className="flex-1 border border-gray-200 rounded-xl bg-[#fafbfc] px-5 py-4 text-xl focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
								/>
								<button
									type="button"
									onClick={handleSendFeedback}
									disabled={
										!feedback.trim() || isStreaming || selectedLabels.size === 0
									}
									className="self-end px-6 py-3.5 text-xl bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
								>
									{isStreaming ? "再生成中..." : "再生成"}
								</button>
							</div>
							{selectedLabels.size === 0 && (
								<p className="text-sm text-amber-600 mt-2">
									ブラッシュアップする目標を1つ以上選択してください
								</p>
							)}
						</div>
					)}
					{count >= 2 && (
						<p className="text-lg text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-5 py-3 mb-8">
							推奨回数の2回に達しました。この目標で確定することをお勧めします。
						</p>
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
							onClick={handleConfirm}
							disabled={saving || isStreaming}
							className="px-10 py-3.5 text-xl bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-glow disabled:opacity-50"
						>
							{saving ? "保存中..." : "この目標で確定する"}
						</button>
					</div>
				</>
			)}
		</div>
	);
}
