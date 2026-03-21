'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Tabs } from '@/components/ui/Tabs'
import { ProfileTab } from '@/components/member/ProfileTab'
import { GoalsTab } from '@/components/member/GoalsTab'
import { OneOnOneTab } from '@/components/member/OneOnOneTab'
import { ReviewsTab } from '@/components/member/ReviewsTab'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import { GoalWizard } from '@/components/goals/GoalWizard'
import { OneOnOneWizard } from '@/components/one-on-one/OneOnOneWizard'
import type { MemberDetail, WizardContextData, OneOnOneWizardContextData } from '@/lib/types'

interface Props {
  member: MemberDetail
  wizardContext: WizardContextData
  oneOnOneContext: OneOnOneWizardContextData
}

export function MemberDetailClient({ member, wizardContext, oneOnOneContext }: Props) {
  const [goalWizardOpen, setGoalWizardOpen] = useState(false)
  const [oneOnOneWizardOpen, setOneOnOneWizardOpen] = useState(false)
  const router = useRouter()

  const handleCloseGoalWizard = () => {
    setGoalWizardOpen(false)
    router.refresh()
  }

  const handleCloseOneOnOneWizard = () => {
    setOneOnOneWizardOpen(false)
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
      content: <ReviewsTab reviews={member.reviews} />,
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
      <div className="flex h-[calc(100vh-56px)]">
        <div className="flex-1 overflow-y-auto">
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
        <div className="w-[520px] border-l border-gray-200 bg-white flex flex-col">
          <ChatSidebar memberName={member.name} memberContext={member.rawMarkdown} />
        </div>
      </div>

      {goalWizardOpen && (
        <GoalWizard context={wizardContext} onClose={handleCloseGoalWizard} />
      )}
      {oneOnOneWizardOpen && (
        <OneOnOneWizard context={oneOnOneContext} onClose={handleCloseOneOnOneWizard} />
      )}
    </>
  )
}
