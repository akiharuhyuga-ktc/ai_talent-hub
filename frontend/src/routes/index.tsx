import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import axios from "axios";
import { MemberGrid } from "@/components/dashboard/MemberGrid";
import { StatsBar } from "@/components/dashboard/StatsBar";
import type { MemberSummary } from "@/lib/types";

export const Route = createFileRoute("/")({
	component: DashboardPage,
});

function DashboardPage() {
	const { data: members, isLoading } = useQuery({
		queryKey: ["members"],
		queryFn: async () => {
			const res = await axios.get<MemberSummary[]>("/api/members");
			return res.data;
		},
	});

	return (
		<main className="px-10 py-8">
			<div className="mb-8">
				<h1 className="text-4xl font-bold text-gray-900 tracking-tight">
					ダッシュボード
				</h1>
				<p className="text-xl text-gray-400 mt-1">
					モバイルアプリ開発部 — チーム全体の状況を把握
				</p>
			</div>

			{isLoading ? (
				<div className="text-xl text-gray-400">読み込み中...</div>
			) : members ? (
				<div className="space-y-8">
					<StatsBar members={members} />
					<div>
						<h2 className="text-2xl font-semibold text-gray-900 mb-4">
							メンバー
						</h2>
						<MemberGrid members={members} />
					</div>
				</div>
			) : null}
		</main>
	);
}
