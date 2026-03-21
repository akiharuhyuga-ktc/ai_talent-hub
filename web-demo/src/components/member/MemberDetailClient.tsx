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
import type { MemberDetail, WizardContextData, OneOnOneWizardContextData, EvaluationWizardContextData } from '@/lib/types'

interface Props {
  member: MemberDetail
  wizardContext: WizardContextData
  oneOnOneContext: OneOnOneWizardContextData
  evaluationContext: EvaluationWizardContextData
}

export function MemberDetailClient({ member, wizardContext, oneOnOneContext, evaluationContext }: Props) {
  const [goalWizardOpen, setGoalWizardOpen] = useState(false)
  const [oneOnOneWizardOpen, setOneOnOneWizardOpen] = useState(false)
  const [evalWizardOpen, setEvalWizardOpen] = useState(false)
  const router = useRouter()

  const handleCloseWizard = (setter: (v: boolean) => void) => () => {
    setter(false)
    router.refresh()
  }

  const tabs = [
    {
      id: 'profile',
      label: 'プロフィール',
      content: <ProfileTab member={member} />,
    },
    {
      id: 'goals',
      label: '目標（2026上期）',
      content: <GoalsTab goals={member.goals} onStartWizard={() => setGoalWizardOpen(true)} />,
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

  return (
    <>
      <div className="h-[calc(100vh-56px)] overflow-y-auto">
        <div className="px-8 py-7">
          <div className="flex items-center gap-2 mb-7 text-sm">
            <Link href="/" className="text-indigo-600 hover:text-indigo-800 transition-colors font-medium">
              ← ダッシュボード
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-700 font-semibold">{member.name}</span>
          </div>
          <Tabs tabs={tabs} defaultTab="profile" />
        </div>
      </div>

      {goalWizardOpen && <GoalWizard context={wizardContext} onClose={handleCloseWizard(setGoalWizardOpen)} />}
      {oneOnOneWizardOpen && <OneOnOneWizard context={oneOnOneContext} onClose={handleCloseWizard(setOneOnOneWizardOpen)} />}
      {evalWizardOpen && <EvaluationWizard context={evaluationContext} onClose={handleCloseWizard(setEvalWizardOpen)} />}
    </>
  )
}
