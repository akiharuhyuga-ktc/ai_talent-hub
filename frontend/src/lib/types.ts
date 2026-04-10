export interface ProjectAllocation {
	name: string;
	april: number;
	may: number;
	june: number;
	avgPct: number;
}

export interface MemberSummary {
	name: string;
	folderName: string;
	role: string;
	team: string;
	teamShort: string;
	joinedAt: string;
	projects: ProjectAllocation[];
	mainProject: string;
	rdPct: number;
}

export interface MemberProfile {
	name: string;
	role: string;
	team: string;
	teamShort: string;
	joinedAt: string;
	projects: ProjectAllocation[];
	skills: {
		technical: string;
		experience: string;
		strengths: string;
		challenges: string;
	};
	expectedRole: {
		current: string;
		longTerm: string;
	};
	rawMarkdown: string;
}

export interface GoalsData {
	period: string;
	memberName: string;
	rawMarkdown: string;
}

export interface SingleGoal {
	index: number;
	label: string;
	type: string;
	title: string;
	content: string;
}

export interface OneOnOneRecord {
	filename: string;
	date: string;
	rawMarkdown: string;
}

export type EvaluationGrade = "S" | "A" | "B" | "C" | "D";

export interface ReviewData {
	period: string;
	filename: string;
	grade: string;
	roleName: string;
	h2Eval: string;
	annualEval: string;
	promotion: boolean;
	feedbackPoints: string;
	feedbackExpectations: string;
	evaluatorComments: {
		label: string;
		evaluator: string;
		content: string;
	}[];
	rawMarkdown: string;
}

export interface MemberDetail extends MemberProfile {
	goals: GoalsData | null;
	goalsByPeriod: Record<string, GoalsData>;
	activePeriod: string;
	oneOnOnes: OneOnOneRecord[];
	reviews: ReviewData[];
}

export interface MemberPeriodStatus {
	memberId: string;
	memberName: string;
	team: string;
	hasGoal: boolean;
	oneOnOneMonths: string[];
	hasReview: boolean;
}

export interface TeamPeriodMatrix {
	period: string;
	members: MemberPeriodStatus[];
}

export interface ChatMessage {
	role: "user" | "assistant";
	content: string;
}
