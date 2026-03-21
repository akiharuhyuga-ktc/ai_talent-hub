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

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  memberName?: string
  memberContext?: string
}
