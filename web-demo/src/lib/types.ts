export interface ProjectAllocation {
  name: string
  april: number
  may: number
  june: number
  avgPct: number
}

export interface MemberProfile {
  name: string
  role: string
  team: string
  teamShort: string
  joinedAt: string
  projects: ProjectAllocation[]
  skills: {
    technical: string
    experience: string
    strengths: string
    challenges: string
  }
  expectedRole: {
    current: string
    longTerm: string
  }
  rawMarkdown: string
}

export interface GoalsData {
  period: string
  memberName: string
  rawMarkdown: string
}

export interface OneOnOneRecord {
  filename: string
  date: string
  rawMarkdown: string
}

export interface ReviewData {
  period: string
  filename: string
  grade: string
  roleName: string
  h2Eval: string
  annualEval: string
  promotion: boolean
  feedbackPoints: string
  feedbackExpectations: string
  evaluatorComments: {
    label: string
    evaluator: string
    content: string
  }[]
  rawMarkdown: string
  // New format fields (optional for backward compatibility)
  goalEvaluations?: GoalEvaluation[]
  overallGrade?: EvaluationGrade
  overallComment?: string
  selfEvalGapAnalysis?: string
  managerChangeLog?: string[]
}

// Evaluation Wizard types
export type EvaluationGrade = 'S' | 'A' | 'B' | 'C' | 'D'

export interface SelfEvaluation {
  score: EvaluationGrade | ''
  achievementComment: string
  reflectionComment: string
}

export interface ManagerSupplementary {
  notableEpisodes: string
  environmentChanges: string
}

export interface GoalEvaluation {
  goalLabel: string
  goalText: string
  grade: EvaluationGrade | ''
  rationale: string
  changeReason: string  // If manager changed from AI draft
}

export interface EvaluationDraft {
  goalEvaluations: GoalEvaluation[]
  overallGrade: EvaluationGrade | ''
  overallRationale: string
  selfEvalGap: string
  specialNotes: string
}

export interface EvaluationWizardState {
  currentStep: number
  period: string
  selfEvaluation: SelfEvaluation
  managerSupplementary: ManagerSupplementary
  aiDraft: EvaluationDraft | null
  confirmedDraft: EvaluationDraft | null
  evaluatorComment: string
  aiCommentDraft: string | null
}

export interface EvaluationWizardContextData {
  memberName: string
  memberProfile: string
  orgPolicy: string
  evaluationCriteria: string
  guidelines: string
  goalsRawMarkdown: string | null
  oneOnOneRecords: OneOnOneRecord[]
  previousReview: ReviewData | null
}

export interface MemberDetail extends MemberProfile {
  goals: GoalsData | null                      // アクティブ期間の目標（後方互換）
  goalsByPeriod: Record<string, GoalsData>     // 全期間の目標
  activePeriod: string                         // アクティブ期間 例: "2025-h2"
  oneOnOnes: OneOnOneRecord[]
  reviews: ReviewData[]
}

export interface MemberSummary {
  name: string
  role: string
  team: string
  teamShort: string
  joinedAt: string
  projects: ProjectAllocation[]
  mainProject: string
  rdPct: number
}

// Goal Wizard types
export interface ManagerInput {
  expectations: string
  biggestChallenge: string
}

export interface MemberInput {
  growthArea: string
  currentDifficulties: string
  oneYearVision: string
}

export interface PreviousPeriod {
  previousGoals: string
  achievementLevel: 'achieved' | 'mostly-achieved' | 'not-achieved' | ''
  reasonIfNotAchieved: string
}

export interface GoalWizardState {
  currentStep: number
  managerInput: ManagerInput
  memberInput: MemberInput
  previousPeriod: PreviousPeriod
  diagnosis: string | null
  diagnosisConfirmed: boolean
  generatedGoals: string | null
  refinementMessages: ChatMessage[]
  refinementCount: number
  finalGoals: string | null
}

export interface WizardContextData {
  memberName: string
  memberProfile: string
  orgPolicy: string
  evaluationCriteria: string
  guidelines: string
  targetPeriod: string   // 目標設定対象期間（GoalsTabから渡される）
}

// 1on1 Wizard types
export interface ConditionScore {
  motivation: number | null  // 1-5, null = unselected
  workload: number | null
  teamRelations: number | null
  comment: string
}

export interface ActionItem {
  content: string
  assignee: 'manager' | 'member' | 'both'
  deadline: string  // YYYY-MM-DD
}

export interface ActionItemReview {
  content: string
  assignee: 'manager' | 'member' | 'both'
  status: 'completed' | 'incomplete' | 'ongoing' | ''
  comment: string
}

export interface GoalProgressEntry {
  goalLabel: string
  goalText: string
  achievedState: string
  milestone: string
  verificationMethod: string
  status: 'on-track' | 'at-risk' | 'delayed' | ''
  progressComment: string
}

export interface HearingQuestion {
  question: string
  intent: string
  memo: string
}

export interface OneOnOneWizardState {
  currentStep: number
  yearMonth: string  // YYYY-MM
  actionReviews: ActionItemReview[]
  goalProgress: GoalProgressEntry[]
  condition: ConditionScore
  hearingQuestions: HearingQuestion[]
  additionalMemo: string
  nextActions: ActionItem[]
  aiSummary: string | null
  isFirstTime: boolean
}

export interface OneOnOneWizardContextData {
  memberName: string
  memberProfile: string
  orgPolicy: string
  guidelines: string
  goalsRawMarkdown: string | null
  previousOneOnOne: OneOnOneRecord | null
  previousActionItems: ActionItem[]
  previousCondition: ConditionScore | null
  previousSummary: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  memberName?: string
  memberContext?: string
}
