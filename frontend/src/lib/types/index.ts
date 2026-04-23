/**
 * 型バレルファイル
 *
 * API型は OpenAPI → Orval 生成。Wizard型は手書き。
 * 既存の import from "@/lib/types" は変更不要。
 */

// API データ型（Orval 生成）
export type {
	ChatMessage,
	ChatMessageRole,
	EvaluationGrade,
	EvaluatorComment,
	ExpectedRole,
	GoalsData,
	MemberDetail,
	MemberDetailAllOf,
	MemberPeriodStatus,
	MemberProfile,
	MemberSummary,
	OneOnOneRecord,
	ParsedGoals,
	ProjectAllocation,
	ReviewData,
	SingleGoal,
	SkillSet,
	TeamPeriodMatrix,
} from "@/api/generated/types";

// Wizard / UI ステート型（手書き）
export type {
	ActionItem,
	ActionItemReview,
	ChatRequest,
	ConditionScore,
	EvaluationDraft,
	EvaluationWizardContextData,
	EvaluationWizardState,
	GoalEvaluation,
	GoalProgressEntry,
	GoalWizardState,
	HearingQuestion,
	ManagerInput,
	ManagerSupplementary,
	MemberInput,
	OneOnOneWizardContextData,
	OneOnOneWizardState,
	PreviousPeriod,
	SelfEvaluation,
	WizardContextData,
} from "./wizard";
