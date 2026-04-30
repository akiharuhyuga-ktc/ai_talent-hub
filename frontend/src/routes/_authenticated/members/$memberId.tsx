import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import customInstance from "@/api/custom-instance";
import { EvaluationWizard } from "@/components/evaluation/EvaluationWizard";
import { GoalWizard } from "@/components/goals/GoalWizard";
import { DeleteMemberDialog } from "@/components/member/DeleteMemberDialog";
import { GoalsTab } from "@/components/member/GoalsTab";
import { OneOnOneTab } from "@/components/member/OneOnOneTab";
import { ProfileTab } from "@/components/member/ProfileTab";
import { ReviewsTab } from "@/components/member/ReviewsTab";
import { OneOnOneWizard } from "@/components/one-on-one/OneOnOneWizard";
import { Tabs } from "@/components/ui/Tabs";
import { dataStore } from "@/lib/data-store";
import {
	parseActionItems,
	parseConditionScore,
	parseSummary,
} from "@/lib/parsers/one-on-one";
import type {
	EvaluationWizardContextData,
	GoalsData,
	MemberDetail,
	OneOnOneRecord,
	OneOnOneWizardContextData,
	ReviewData,
	WizardContextData,
} from "@/lib/types";
import { formatPeriodLabel } from "@/lib/utils/period";

interface DocsData {
	orgPolicy: string;
	criteria: string;
	guidelines: string;
}

interface MemberExtras {
	goalsByPeriod: Record<string, GoalsData>;
	oneOnOnes: OneOnOneRecord[];
	reviews: ReviewData[];
}

const EMPTY_EXTRAS: MemberExtras = {
	goalsByPeriod: {},
	oneOnOnes: [],
	reviews: [],
};

export const Route = createFileRoute("/_authenticated/members/$memberId")({
	component: MemberDetailPage,
});

function MemberDetailPage() {
	const { memberId } = Route.useParams();
	const queryClient = useQueryClient();

	const [goalWizardOpen, setGoalWizardOpen] = useState(false);
	const [goalWizardPeriod, setGoalWizardPeriod] = useState("");
	const [evalWizardOpen, setEvalWizardOpen] = useState(false);
	const [oneOnOneWizardOpen, setOneOnOneWizardOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

	const { data: profile, isLoading: profileLoading } = useQuery({
		queryKey: ["members", memberId, "profile"],
		queryFn: () => dataStore.members.get(memberId),
	});

	const { data: extras = EMPTY_EXTRAS } = useQuery({
		queryKey: ["members", memberId, "extras"],
		queryFn: async (): Promise<MemberExtras> => {
			try {
				return await customInstance<MemberExtras>({
					method: "get",
					url: `/api/members/${memberId}/extras`,
				});
			} catch (err) {
				console.warn("failed to load member extras", err);
				return EMPTY_EXTRAS;
			}
		},
		enabled: !!profile,
	});

	const member: MemberDetail | null = profile
		? {
				...profile,
				projects: [],
				goals: extras.goalsByPeriod?.[profile.activePeriod] ?? null,
				goalsByPeriod: extras.goalsByPeriod ?? {},
				activePeriod: profile.activePeriod,
				oneOnOnes: extras.oneOnOnes ?? [],
				reviews: extras.reviews ?? [],
			}
		: null;

	const { data: docs } = useQuery({
		queryKey: ["docs"],
		queryFn: async () => {
			try {
				return await customInstance<DocsData>({
					method: "get",
					url: "/api/docs",
				});
			} catch (err) {
				console.warn("failed to load docs", err);
				return null;
			}
		},
	});

	const invalidateMember = () => {
		queryClient.invalidateQueries({
			queryKey: ["members", memberId, "extras"],
		});
	};

	if (profileLoading) {
		return (
			<main className="px-10 py-8">
				<div className="text-xl text-gray-400">読み込み中...</div>
			</main>
		);
	}

	if (!profile) {
		return (
			<main className="px-10 py-8">
				<div className="text-xl text-gray-500">メンバーが見つかりません</div>
			</main>
		);
	}

	if (!member) {
		return (
			<main className="px-10 py-8">
				<div className="text-xl text-gray-400">読み込み中...</div>
			</main>
		);
	}

	const handleStartGoalWizard = (period: string) => {
		setGoalWizardPeriod(period);
		setGoalWizardOpen(true);
	};

	const handleStartEvalWizard = () => {
		setEvalWizardOpen(true);
	};

	const handleStartOneOnOneWizard = () => {
		setOneOnOneWizardOpen(true);
	};

	// Build wizard context objects
	const goalWizardContext: WizardContextData | null = docs
		? {
				memberId: member.id,
				memberName: member.name,
				memberProfile: member.rawMarkdown,
				orgPolicy: docs.orgPolicy,
				evaluationCriteria: docs.criteria,
				guidelines: docs.guidelines,
				targetPeriod: goalWizardPeriod || member.activePeriod,
			}
		: null;

	const evalWizardContext: EvaluationWizardContextData | null = docs
		? {
				memberId: member.id,
				memberName: member.name,
				memberProfile: member.rawMarkdown,
				orgPolicy: docs.orgPolicy,
				evaluationCriteria: docs.criteria,
				guidelines: docs.guidelines,
				goalsRawMarkdown: member.goals?.rawMarkdown ?? null,
				oneOnOneRecords: member.oneOnOnes,
				previousReview: member.reviews.length > 0 ? member.reviews[0] : null,
			}
		: null;

	const buildOneOnOneContext = (): OneOnOneWizardContextData | null => {
		if (!docs) return null;
		const previousOneOnOne =
			member.oneOnOnes.length > 0 ? member.oneOnOnes[0] : null;
		const previousActionItems = previousOneOnOne
			? parseActionItems(previousOneOnOne.rawMarkdown)
			: [];
		const previousCondition = previousOneOnOne
			? parseConditionScore(previousOneOnOne.rawMarkdown)
			: null;
		const previousSummary = previousOneOnOne
			? parseSummary(previousOneOnOne.rawMarkdown)
			: "";

		return {
			memberId: member.id,
			memberName: member.name,
			memberProfile: member.rawMarkdown,
			orgPolicy: docs.orgPolicy,
			guidelines: docs.guidelines,
			goalsRawMarkdown: member.goals?.rawMarkdown ?? null,
			previousOneOnOne,
			previousActionItems,
			previousCondition,
			previousSummary,
		};
	};

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
					memberId={member.id}
					memberProfile={member.rawMarkdown}
					onStartWizard={handleStartGoalWizard}
					isWizardOpen={goalWizardOpen}
					onGoalsUpdated={invalidateMember}
				/>
			),
		},
		{
			id: "reviews",
			label: `評価 (${member.reviews.length})`,
			content: (
				<ReviewsTab
					reviews={member.reviews}
					onStartWizard={handleStartEvalWizard}
				/>
			),
		},
		{
			id: "one-on-one",
			label: `1on1記録 (${member.oneOnOnes.length})`,
			content: (
				<OneOnOneTab
					oneOnOnes={member.oneOnOnes}
					onStartWizard={handleStartOneOnOneWizard}
				/>
			),
		},
	];

	const oneOnOneContext = buildOneOnOneContext();

	return (
		<div className="h-screen overflow-y-auto">
			<div className="px-10 py-8">
				<div className="flex items-center justify-between mb-6">
					<div className="flex items-center gap-2 text-xl">
						<Link
							to="/"
							className="text-brand-600 hover:text-brand-800 transition-colors font-medium"
						>
							ダッシュボード
						</Link>
						<span className="text-gray-300">/</span>
						<span className="text-gray-600 font-medium">{member.name}</span>
					</div>
					<button
						type="button"
						onClick={() => setDeleteDialogOpen(true)}
						className="px-4 py-2 text-lg text-red-500 border border-red-200 rounded-lg font-medium hover:bg-red-50 transition-colors"
					>
						メンバーを削除
					</button>
				</div>
				<Tabs tabs={tabs} defaultTab="profile" />
			</div>

			{goalWizardOpen && goalWizardContext && (
				<GoalWizard
					context={goalWizardContext}
					onClose={() => {
						setGoalWizardOpen(false);
						invalidateMember();
					}}
				/>
			)}

			{evalWizardOpen && evalWizardContext && (
				<EvaluationWizard
					context={evalWizardContext}
					onClose={() => {
						setEvalWizardOpen(false);
						invalidateMember();
					}}
				/>
			)}

			{oneOnOneWizardOpen && oneOnOneContext && (
				<OneOnOneWizard
					context={oneOnOneContext}
					onClose={() => {
						setOneOnOneWizardOpen(false);
						invalidateMember();
					}}
				/>
			)}

			<DeleteMemberDialog
				open={deleteDialogOpen}
				memberId={member.id}
				memberName={member.name}
				onClose={() => setDeleteDialogOpen(false)}
			/>
		</div>
	);
}
