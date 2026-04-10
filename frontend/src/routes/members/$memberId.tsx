import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import axios from "axios";
import { GoalsTab } from "@/components/member/GoalsTab";
import { OneOnOneTab } from "@/components/member/OneOnOneTab";
import { ProfileTab } from "@/components/member/ProfileTab";
import { ReviewsTab } from "@/components/member/ReviewsTab";
import { Tabs } from "@/components/ui/Tabs";
import type { MemberDetail } from "@/lib/types";
import { formatPeriodLabel } from "@/lib/utils/period";

export const Route = createFileRoute("/members/$memberId")({
	component: MemberDetailPage,
});

function MemberDetailPage() {
	const { memberId } = Route.useParams();

	const { data: member, isLoading } = useQuery({
		queryKey: ["members", memberId],
		queryFn: async () => {
			const res = await axios.get<MemberDetail>(`/api/members/${memberId}`);
			return res.data;
		},
	});

	if (isLoading) {
		return (
			<main className="px-10 py-8">
				<div className="text-xl text-gray-400">読み込み中...</div>
			</main>
		);
	}

	if (!member) {
		return (
			<main className="px-10 py-8">
				<div className="text-xl text-gray-500">メンバーが見つかりません</div>
			</main>
		);
	}

	const tabs = [
		{
			id: "profile",
			label: "プロフィール",
			content: <ProfileTab member={member} />,
		},
		{
			id: "goals",
			label: `目標（${formatPeriodLabel(member.activePeriod)}）`,
			content: (
				<GoalsTab
					goalsByPeriod={member.goalsByPeriod}
					activePeriod={member.activePeriod}
				/>
			),
		},
		{
			id: "reviews",
			label: `評価 (${member.reviews.length})`,
			content: <ReviewsTab reviews={member.reviews} />,
		},
		{
			id: "one-on-one",
			label: `1on1記録 (${member.oneOnOnes.length})`,
			content: <OneOnOneTab oneOnOnes={member.oneOnOnes} />,
		},
	];

	return (
		<div className="h-screen overflow-y-auto">
			<div className="px-10 py-8">
				<div className="flex items-center gap-2 mb-6 text-xl">
					<Link
						to="/"
						className="text-brand-600 hover:text-brand-800 transition-colors font-medium"
					>
						ダッシュボード
					</Link>
					<span className="text-gray-300">/</span>
					<span className="text-gray-600 font-medium">{member.name}</span>
				</div>
				<Tabs tabs={tabs} defaultTab="profile" />
			</div>
		</div>
	);
}
