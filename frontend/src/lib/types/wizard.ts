/**
 * Wizard / UI ステート型 — フロントエンド専用
 *
 * これらの型は OpenAPI に含めず、手書きで管理する。
 * API型を参照する場合は同じバレルからインポートする。
 */

import type {
	ChatMessage,
	EvaluationGrade,
	OneOnOneRecord,
	ReviewData,
} from "@/api/generated/types";

// ---------------------------------------------------------------------------
// Goal Wizard
// ---------------------------------------------------------------------------

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
	memberId: string;
	memberName: string;
	memberProfile: string;
	orgPolicy: string;
	evaluationCriteria: string;
	guidelines: string;
	targetPeriod: string;
}

// ---------------------------------------------------------------------------
// Evaluation Wizard
// ---------------------------------------------------------------------------

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
	memberId: string;
	memberName: string;
	memberProfile: string;
	orgPolicy: string;
	evaluationCriteria: string;
	guidelines: string;
	goalsRawMarkdown: string | null;
	oneOnOneRecords: OneOnOneRecord[];
	previousReview: ReviewData | null;
}

// ---------------------------------------------------------------------------
// 1on1 Wizard
// ---------------------------------------------------------------------------

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
	reason?: string;
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
	memberId: string;
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

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatRequest {
	messages: ChatMessage[];
	memberName?: string;
	memberContext?: string;
}
