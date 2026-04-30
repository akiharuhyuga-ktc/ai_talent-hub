import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AddMemberModal } from "@/components/dashboard/AddMemberModal";
import { MemberGrid } from "@/components/dashboard/MemberGrid";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { dataStore } from "@/lib/data-store";

export const Route = createFileRoute("/_authenticated/")({
	component: DashboardPage,
});

function DashboardPage() {
	const [addOpen, setAddOpen] = useState(false);

	const { data: members, isLoading } = useQuery({
		queryKey: ["members"],
		queryFn: () => dataStore.members.list(),
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
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-2xl font-semibold text-gray-900">メンバー</h2>
							<button
								type="button"
								onClick={() => setAddOpen(true)}
								className="px-5 py-2 text-xl bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 transition-colors"
							>
								＋ メンバー追加
							</button>
						</div>
						<MemberGrid members={members} />
					</div>
				</div>
			) : null}

			<AddMemberModal open={addOpen} onClose={() => setAddOpen(false)} />
		</main>
	);
}
