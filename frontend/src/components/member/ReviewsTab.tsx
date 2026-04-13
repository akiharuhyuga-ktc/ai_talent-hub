import { useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import type { ReviewData } from "@/lib/types";

interface ReviewsTabProps {
	reviews: ReviewData[];
	onStartWizard?: () => void;
}

const evalColorMap: Record<
	string,
	{ bg: string; text: string; border: string }
> = {
	S: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300" },
	A: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300" },
	B: { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-300" },
	C: { bg: "bg-red-50", text: "text-red-600", border: "border-red-300" },
	D: { bg: "bg-red-100", text: "text-red-700", border: "border-red-400" },
};

function EvalBadge({ value, label }: { value: string; label: string }) {
	const colors = evalColorMap[value] || evalColorMap.B;
	return (
		<div className="text-center">
			<div className="text-xs text-gray-500 mb-1">{label}</div>
			<span
				className={`inline-flex items-center justify-center w-12 h-12 rounded-xl text-2xl font-bold border-2 ${colors.bg} ${colors.text} ${colors.border}`}
			>
				{value}
			</span>
		</div>
	);
}

function CommentSection({
	comment,
}: {
	comment: { label: string; evaluator: string; content: string };
}) {
	const [isOpen, setIsOpen] = useState(false);

	const labelColors: Record<string, string> = {
		本人コメント: "bg-green-100 text-green-700",
		プレ一次評価: "bg-purple-100 text-purple-700",
		一次評価: "bg-blue-100 text-blue-700",
		二次評価: "bg-brand-100 text-brand-700",
		三次評価: "bg-gray-100 text-gray-700",
	};

	return (
		<div className="border border-gray-200 rounded-lg overflow-hidden">
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
			>
				<div className="flex items-center gap-3">
					<span
						className={`text-xs font-medium px-2 py-0.5 rounded-full ${labelColors[comment.label] || "bg-gray-100 text-gray-600"}`}
					>
						{comment.label}
					</span>
					{comment.evaluator && (
						<span className="text-sm text-gray-500">{comment.evaluator}</span>
					)}
				</div>
				<svg
					className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					aria-hidden="true"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M19 9l-7 7-7-7"
					/>
				</svg>
			</button>
			{isOpen && (
				<div className="px-5 py-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
					{comment.content}
				</div>
			)}
		</div>
	);
}

function ReviewCard({ review }: { review: ReviewData }) {
	return (
		<div>
			<div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
				<div className="flex items-start justify-between">
					<div>
						<h3 className="text-xl font-semibold text-gray-800">
							{review.period}
						</h3>
						<div className="flex items-center gap-3 mt-2">
							{review.grade && (
								<span className="text-sm text-gray-500">
									等級 {review.grade}
								</span>
							)}
							{review.roleName && (
								<span className="text-sm text-gray-500">{review.roleName}</span>
							)}
							{review.promotion && (
								<span className="text-sm font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
									昇格
								</span>
							)}
						</div>
					</div>
					<div className="flex items-center gap-6">
						<EvalBadge value={review.h2Eval} label="下期評価" />
						<EvalBadge value={review.annualEval} label="年間評価" />
					</div>
				</div>
			</div>

			{(review.feedbackPoints || review.feedbackExpectations) && (
				<div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
					<h4 className="text-lg font-semibold text-gray-800 mb-4">
						フィードバック
					</h4>
					{review.feedbackPoints && (
						<div className="mb-5">
							<h5 className="text-sm font-medium text-gray-500 mb-2">
								評価のポイント
							</h5>
							<div className="text-sm text-gray-700 leading-relaxed">
								<MarkdownRenderer content={review.feedbackPoints} />
							</div>
						</div>
					)}
					{review.feedbackExpectations && (
						<div>
							<h5 className="text-sm font-medium text-gray-500 mb-2">
								今後の期待
							</h5>
							<div className="text-sm text-gray-700 leading-relaxed">
								<MarkdownRenderer content={review.feedbackExpectations} />
							</div>
						</div>
					)}
				</div>
			)}

			{review.evaluatorComments.length > 0 && (
				<div className="bg-white border border-gray-200 rounded-xl p-6">
					<h4 className="text-lg font-semibold text-gray-800 mb-4">
						各評価者コメント
					</h4>
					<div className="space-y-2">
						{review.evaluatorComments.map((comment) => (
							<CommentSection key={comment.label} comment={comment} />
						))}
					</div>
				</div>
			)}
		</div>
	);
}

export function ReviewsTab({ reviews, onStartWizard }: ReviewsTabProps) {
	if (reviews.length === 0) {
		return (
			<EmptyState
				title="評価データがありません"
				description="reviews/ フォルダに評価ファイルがまだ作成されていません"
			/>
		);
	}

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<h3 className="text-3xl font-semibold text-gray-800">評価・振り返り</h3>
				{onStartWizard && (
					<button
						type="button"
						onClick={onStartWizard}
						className="text-lg bg-brand-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand-700 transition-colors"
					>
						評価ウィザード
					</button>
				)}
			</div>
			<div className="space-y-8">
				{reviews.map((review) => (
					<ReviewCard key={review.period} review={review} />
				))}
			</div>
		</div>
	);
}
