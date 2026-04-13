import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import axios from "axios";
import { useState } from "react";
import { EvaluationWizard } from "@/components/evaluation/EvaluationWizard";
import { GoalWizard } from "@/components/goals/GoalWizard";
import { GoalsTab } from "@/components/member/GoalsTab";
import { OneOnOneTab } from "@/components/member/OneOnOneTab";
import { ProfileTab } from "@/components/member/ProfileTab";
import { ReviewsTab } from "@/components/member/ReviewsTab";
import { OneOnOneWizard } from "@/components/one-on-one/OneOnOneWizard";
import { Tabs } from "@/components/ui/Tabs";
import {
	parseActionItems,
	parseConditionScore,
	parseSummary,
} from "@/lib/parsers/one-on-one";
import type {
	EvaluationWizardContextData,
	MemberDetail,
	OneOnOneWizardContextData,
	WizardContextData,
} from "@/lib/types";
import { formatPeriodLabel } from "@/lib/utils/period";

interface DocsData {
	orgPolicy: string;
	criteria: string;
	guidelines: string;
}

export const Route = createFileRoute("/members/$memberId")({
	component: MemberDetailPage,
});

function MemberDetailPage() {
	const { memberId } = Route.useParams();
	const queryClient = useQueryClient();

	const [goalWizardOpen, setGoalWizardOpen] = useState(false);
	const [goalWizardPeriod, setGoalWizardPeriod] = useState("");
	const [evalWizardOpen, setEvalWizardOpen] = useState(false);
	const [oneOnOneWizardOpen, setOneOnOneWizardOpen] = useState(false);

	const { data: member, isLoading } = useQuery({
		queryKey: ["members", memberId],
		queryFn: async () => {
			const res = await axios.get<MemberDetail>(`/api/members/${memberId}`);
			return res.data;
		},
	});

	const { data: docs } = useQuery({
		queryKey: ["docs"],
		queryFn: async () => {
			const res = await axios.get<DocsData>("/api/docs");
			return res.data;
		},
	});

	const invalidateMember = () => {
		queryClient.invalidateQueries({ queryKey: ["members", memberId] });
	};

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
					onStartWizard={handleStartGoalWizard}
					isWizardOpen={goalWizardOpen}
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
		</div>
	);
}
