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

// Parsed goals
export interface ParsedGoals {
	header: string;
	goals: SingleGoal[];
	footer: string;
}

// Goal Wizard types
export interface ManagerInput {
	expectations: string;
	biggestChallenge: string;
}

export interface MemberInput {
	growthArea: string;
	currentDifficulties: string;
	oneYearVision: string;
}

export interface PreviousPeriod {
	previousGoals: string;
	achievementLevel: "achieved" | "mostly-achieved" | "not-achieved" | "";
	reasonIfNotAchieved: string;
}

export interface GoalWizardState {
	currentStep: number;
	managerInput: ManagerInput;
	memberInput: MemberInput;
	previousPeriod: PreviousPeriod;
	diagnosis: string | null;
	diagnosisConfirmed: boolean;
	generatedGoals: string | null;
	refinementMessages: ChatMessage[];
	refinementCount: number;
	finalGoals: string | null;
}

export interface WizardContextData {
	memberName: string;
	memberProfile: string;
	orgPolicy: string;
	evaluationCriteria: string;
	guidelines: string;
	targetPeriod: string;
}

// Evaluation Wizard types
export interface SelfEvaluation {
	score: EvaluationGrade | "";
	achievementComment: string;
	reflectionComment: string;
}

export interface ManagerSupplementary {
	notableEpisodes: string;
	environmentChanges: string;
}

export interface GoalEvaluation {
	goalLabel: string;
	goalText: string;
	grade: EvaluationGrade | "";
	rationale: string;
	changeReason: string;
}

export interface EvaluationDraft {
	goalEvaluations: GoalEvaluation[];
	overallGrade: EvaluationGrade | "";
	overallRationale: string;
	selfEvalGap: string;
	specialNotes: string;
}

export interface EvaluationWizardState {
	currentStep: number;
	period: string;
	selfEvaluation: SelfEvaluation;
	managerSupplementary: ManagerSupplementary;
	aiDraft: EvaluationDraft | null;
	confirmedDraft: EvaluationDraft | null;
	evaluatorComment: string;
	aiCommentDraft: string | null;
}

export interface EvaluationWizardContextData {
	memberName: string;
	memberProfile: string;
	orgPolicy: string;
	evaluationCriteria: string;
	guidelines: string;
	goalsRawMarkdown: string | null;
	oneOnOneRecords: OneOnOneRecord[];
	previousReview: ReviewData | null;
}

// 1on1 Wizard types
export interface ConditionScore {
	motivation: number | null;
	workload: number | null;
	teamRelations: number | null;
	comment: string;
}

export interface ActionItem {
	content: string;
	assignee: "manager" | "member" | "both";
	deadline: string;
}

export interface ActionItemReview {
	content: string;
	assignee: "manager" | "member" | "both";
	status: "completed" | "incomplete" | "ongoing" | "";
	comment: string;
}

export interface GoalProgressEntry {
	goalLabel: string;
	goalText: string;
	achievedState: string;
	milestone: string;
	verificationMethod: string;
	status: "on-track" | "at-risk" | "delayed" | "";
	progressComment: string;
}

export interface HearingQuestion {
	question: string;
	intent: string;
	memo: string;
}

export interface OneOnOneWizardState {
	currentStep: number;
	yearMonth: string;
	actionReviews: ActionItemReview[];
	goalProgress: GoalProgressEntry[];
	condition: ConditionScore;
	hearingQuestions: HearingQuestion[];
	additionalMemo: string;
	nextActions: ActionItem[];
	aiSummary: string | null;
	isFirstTime: boolean;
}

export interface OneOnOneWizardContextData {
	memberName: string;
	memberProfile: string;
	orgPolicy: string;
	guidelines: string;
	goalsRawMarkdown: string | null;
	previousOneOnOne: OneOnOneRecord | null;
	previousActionItems: ActionItem[];
	previousCondition: ConditionScore | null;
	previousSummary: string;
}

// Chat
export interface ChatRequest {
	messages: ChatMessage[];
	memberName?: string;
	memberContext?: string;
}
