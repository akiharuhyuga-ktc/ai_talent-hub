import { createFileRoute } from "@tanstack/react-router";
import { TeamMatrixView } from "@/components/dashboard/TeamMatrixView";
import { getActivePeriod } from "@/lib/utils/period";

export const Route = createFileRoute("/team")({
	component: TeamPage,
});

function TeamPage() {
	const activePeriod = getActivePeriod();
	const today = new Date().toISOString().slice(0, 10);

	return (
		<main className="px-10 py-8">
			<div className="mb-8">
				<h1 className="text-4xl font-bold text-gray-900 tracking-tight">
					チームマトリクス
				</h1>
				<p className="text-xl text-gray-400 mt-1">半期ごとのメンバー進捗状況</p>
			</div>
			<TeamMatrixView activePeriod={activePeriod} today={today} />
		</main>
	);
}
