import { EmptyState } from "@/components/ui/EmptyState";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import type { OneOnOneRecord } from "@/lib/types";

interface OneOnOneTabProps {
	oneOnOnes: OneOnOneRecord[];
}

export function OneOnOneTab({ oneOnOnes }: OneOnOneTabProps) {
	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<h3 className="text-3xl font-semibold text-gray-800">1on1記録</h3>
			</div>

			{oneOnOnes.length === 0 ? (
				<EmptyState
					title="1on1記録はまだありません"
					description="ウィザードから1on1を開始できます"
				/>
			) : (
				<div className="space-y-6">
					{oneOnOnes.map((record) => (
						<div
							key={record.filename}
							className="bg-white border border-gray-200 rounded-xl overflow-hidden"
						>
							<div className="bg-gray-50 px-8 py-5 border-b border-gray-200">
								<span className="text-3xl font-semibold text-gray-700">
									{record.date} 実施
								</span>
							</div>
							<div className="p-10">
								<MarkdownRenderer content={record.rawMarkdown} />
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
