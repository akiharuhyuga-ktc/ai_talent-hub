'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Tabs } from '@/components/ui/Tabs'
import { ProfileTab } from '@/components/member/ProfileTab'
import { GoalsTab } from '@/components/member/GoalsTab'
import { OneOnOneTab } from '@/components/member/OneOnOneTab'
import { ReviewsTab } from '@/components/member/ReviewsTab'
import { GoalWizard } from '@/components/goals/GoalWizard'
import { OneOnOneWizard } from '@/components/one-on-one/OneOnOneWizard'
import { EvaluationWizard } from '@/components/evaluation/EvaluationWizard'
import { formatPeriodLabel } from '@/lib/utils/period'
import type { MemberDetail, WizardContextData, OneOnOneWizardContextData, EvaluationWizardContextData } from '@/lib/types'

interface Props {
  member: MemberDetail
  wizardContext: WizardContextData
  oneOnOneContext: OneOnOneWizardContextData
  evaluationContext: EvaluationWizardContextData
}

export function MemberDetailClient({ member, wizardContext, oneOnOneContext, evaluationContext }: Props) {
  const [goalWizardOpen, setGoalWizardOpen] = useState(false)
  const [goalWizardPeriod, setGoalWizardPeriod] = useState(member.activePeriod)
  const [oneOnOneWizardOpen, setOneOnOneWizardOpen] = useState(false)
  const [evalWizardOpen, setEvalWizardOpen] = useState(false)
  const router = useRouter()

  const handleCloseWizard = (setter: (v: boolean) => void) => () => {
    setter(false)
    router.refresh()
  }

  const handleStartGoalWizard = (period: string) => {
    setGoalWizardPeriod(period)
    setGoalWizardOpen(true)
  }

  const tabs = [
    {
      id: 'profile',
      label: 'プロフィール',
      content: <ProfileTab member={member} />,
    },
    {
      id: 'goals',
      label: `目標（${formatPeriodLabel(member.activePeriod)}）`,
      content: (
        <GoalsTab
          goalsByPeriod={member.goalsByPeriod}
          activePeriod={member.activePeriod}
          memberName={member.name}
          memberProfile={member.rawMarkdown}
          onStartWizard={handleStartGoalWizard}
          isWizardOpen={goalWizardOpen}
          onGoalsUpdated={() => router.refresh()}
        />
      ),
    },
    {
      id: 'reviews',
      label: `評価 (${member.reviews.length})`,
      content: <ReviewsTab reviews={member.reviews} onStartWizard={() => setEvalWizardOpen(true)} />,
    },
    {
      id: 'one-on-one',
      label: `1on1記録 (${member.oneOnOnes.length})`,
      content: (
        <OneOnOneTab
          oneOnOnes={member.oneOnOnes}
          onStartWizard={() => setOneOnOneWizardOpen(true)}
        />
      ),
    },
  ]

  // Pass targetPeriod to goal wizard context
  const goalWizardContext = { ...wizardContext, targetPeriod: goalWizardPeriod }

  return (
    <>
      <div className="h-screen overflow-y-auto">
        <div className="px-10 py-8">
          <div className="flex items-center gap-2 mb-6 text-xl">
            <Link href="/" className="text-brand-600 hover:text-brand-800 transition-colors font-medium">
              ダッシュボード
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-gray-600 font-medium">{member.name}</span>
          </div>
          <Tabs tabs={tabs} defaultTab="profile" />
        </div>
      </div>

      {goalWizardOpen && <GoalWizard context={goalWizardContext} onClose={handleCloseWizard(setGoalWizardOpen)} />}
      {oneOnOneWizardOpen && <OneOnOneWizard context={oneOnOneContext} onClose={handleCloseWizard(setOneOnOneWizardOpen)} />}
      {evalWizardOpen && <EvaluationWizard context={evaluationContext} onClose={handleCloseWizard(setEvalWizardOpen)} />}
    </>
  )
}
