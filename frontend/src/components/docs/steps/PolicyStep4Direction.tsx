import { useCallback, useEffect, useRef, useState } from "react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import type { PolicyWizardState } from "../PolicyWizard";

const MAX_REGENERATIONS = 3;

interface PolicyStep4DirectionProps {
	state: PolicyWizardState;
	onConfirm: (direction: string) => void;
	onBack: () => void;
}

export function PolicyStep4Direction({
	state,
	onConfirm,
	onBack,
}: PolicyStep4DirectionProps) {
	const [direction, setDirection] = useState(state.direction || "");
	const [isStreaming, setIsStreaming] = useState(!state.direction);
	const [error, setError] = useState("");
	const [editing, setEditing] = useState(false);
	const [editText, setEditText] = useState("");
	const [regenCount, setRegenCount] = useState(0);
	const abortRef = useRef<AbortController | null>(null);

	const fetchDirection = useCallback(async () => {
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		setIsStreaming(true);
		setError("");

		try {
			const body: Record<string, unknown> = { mode: state.flowMode };

			if (state.flowMode === "continuous") {
				body.prevContent = state.baseContent;
				body.whatWorked = state.review.whatWorked;
				body.whatDidntWork = state.review.whatDidntWork;
				body.leftBehind = state.review.leftBehind;
				body.envChanges = state.continuousThemes.envChanges;
				body.techChanges = state.continuousThemes.techChanges;
				body.focusThemes = state.continuousThemes.focusThemes;
			} else {
				body.teamInfo = state.currentState.teamInfo;
				body.techDomains = state.currentState.techDomains;
				body.challenges = state.currentState.challenges;
				body.strengths = state.currentState.strengths;
				body.mission = state.currentState.mission;
				body.themes = state.currentState.themes;
				body.upperOrgPolicy = state.upperPolicy;
			}

			const res = await fetch("/api/docs/policy/direction", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
				signal: controller.signal,
			});

			if (
				!res.ok ||
				!res.headers.get("content-type")?.includes("text/event-stream")
			) {
				const data = await res.json().catch(() => ({}));
				throw new Error(
					(data as { error?: string }).error || "AI方向性の生成に失敗しました",
				);
			}

			const reader = res.body?.getReader();
			if (!reader) return;
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
							setDirection(fullText);
						}
					} catch (_err) {
						/* ignore parse errors */
					}
				}
			}

			if (fullText) {
				setEditText(fullText);
			}
		} catch (err) {
			if ((err as Error).name !== "AbortError") {
				setError(
					err instanceof Error ? err.message : "AI方向性の生成に失敗しました",
				);
			}
		} finally {
			setIsStreaming(false);
			abortRef.current = null;
		}
	}, [state]);

	useEffect(() => {
		if (!state.direction) {
			fetchDirection();
		} else {
			setEditText(state.direction);
		}
		return () => {
			abortRef.current?.abort();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fetchDirection, state.direction]);

	const handleRegenerate = async () => {
		if (regenCount >= MAX_REGENERATIONS) return;
		setRegenCount((prev) => prev + 1);
		setEditing(false);
		await fetchDirection();
	};

	const handleToggleEdit = () => {
		if (editing) {
			setDirection(editText);
			setEditing(false);
		} else {
			setEditText(direction);
			setEditing(true);
		}
	};

	const handleConfirm = () => {
		const finalDirection = editing ? editText : direction;
		onConfirm(finalDirection);
	};

	return (
		<div>
			<h2 className="text-4xl font-bold text-gray-800 mb-3">
				{state.flowMode === "continuous" ? "AI方向性の提案" : "AI骨格の提案"}
			</h2>
			<p className="text-xl text-gray-500 mb-8">
				{isStreaming
					? "AIが方向性を生成中..."
					: "入力内容をもとにAIが方針の方向性を提案します。確認・修正してから草案生成に進みます。"}
			</p>

			{!direction && isStreaming && (
				<div className="flex flex-col items-center justify-center py-20">
					<div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-6" />
					<p className="text-xl text-gray-500">AIが方向性を生成中...</p>
				</div>
			)}

			{error && !isStreaming && (
				<div className="text-center py-12">
					<p className="text-xl text-red-600 bg-red-50 border border-red-200 rounded-lg px-5 py-4 mb-6">
						{error}
					</p>
					<div className="flex gap-3 justify-center">
						<button
							type="button"
							onClick={onBack}
							className="px-8 py-3.5 text-xl border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
						>
							戻る
						</button>
						<button
							type="button"
							onClick={handleRegenerate}
							disabled={regenCount >= MAX_REGENERATIONS}
							className="px-8 py-3.5 text-xl bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-glow disabled:opacity-40"
						>
							再試行
						</button>
					</div>
				</div>
			)}

			{direction && (
				<>
					{/* Edit toggle */}
					{!isStreaming && (
						<div className="flex items-center gap-3 mb-4">
							<button
								type="button"
								onClick={handleToggleEdit}
								className="text-xl text-brand-600 hover:text-brand-800 font-medium transition-colors"
							>
								{editing ? "編集を確定" : "修正する"}
							</button>
							{editing && (
								<button
									type="button"
									onClick={() => {
										setEditText(direction);
										setEditing(false);
									}}
									className="text-lg text-gray-400 hover:text-gray-600 transition-colors"
								>
									キャンセル
								</button>
							)}
						</div>
					)}

					{/* Content */}
					{editing ? (
						<textarea
							value={editText}
							onChange={(e) => setEditText(e.target.value)}
							className="w-full border border-gray-200 rounded-xl bg-[#fafbfc] px-5 py-4 text-xl font-mono resize-none focus:outline-none focus:ring-2 focus:ring-brand-400 h-[400px]"
							spellCheck={false}
						/>
					) : (
						<div className="bg-white border border-gray-200 rounded-lg p-8 mb-4 max-h-[500px] overflow-y-auto">
							<MarkdownRenderer content={direction} />
							{isStreaming && (
								<span className="inline-block w-2 h-5 bg-brand-500 animate-pulse ml-1" />
							)}
						</div>
					)}

					{/* Regenerate info */}
					<p className="text-lg text-gray-400 mt-4 mb-6">
						再生成: {regenCount}/{MAX_REGENERATIONS}回
					</p>

					{/* Actions */}
					{!isStreaming && (
						<div className="flex justify-end gap-4">
							<button
								type="button"
								onClick={onBack}
								className="py-3.5 px-8 text-xl border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
							>
								戻る
							</button>
							<button
								type="button"
								onClick={handleRegenerate}
								disabled={regenCount >= MAX_REGENERATIONS}
								className="py-3.5 px-8 text-xl border border-brand-300 text-brand-600 rounded-xl font-medium hover:bg-brand-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
							>
								再生成
							</button>
							<button
								type="button"
								onClick={handleConfirm}
								className="px-10 py-3.5 text-xl bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-glow"
							>
								この方向性で草案を生成する
							</button>
						</div>
					)}
				</>
			)}
		</div>
	);
}
