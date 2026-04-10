import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/docs")({
	component: DocsPage,
});

function DocsPage() {
	return (
		<main className="px-10 py-8">
			<div className="mb-8">
				<h1 className="text-4xl font-bold text-gray-900 tracking-tight">
					組織方針・評価基準
				</h1>
				<p className="text-xl text-gray-400 mt-1">
					部方針と評価基準のドキュメント
				</p>
			</div>
			<div className="text-xl text-gray-500">
				Phase 4 でドキュメント表示を実装予定
			</div>
		</main>
	);
}
