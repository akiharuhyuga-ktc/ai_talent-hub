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
}

export interface MemberDetail extends MemberProfile {
  goals: GoalsData | null
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
  departmentPolicy: string
  evaluationCriteria: string
  guidelines: string
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
  departmentPolicy: string
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
