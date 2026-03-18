import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getMemberDetail } from '@/lib/fs/members'
import { Tabs } from '@/components/ui/Tabs'
import { ProfileTab } from '@/components/member/ProfileTab'
import { GoalsTab } from '@/components/member/GoalsTab'
import { OneOnOneTab } from '@/components/member/OneOnOneTab'
import { ChatSidebar } from '@/components/chat/ChatSidebar'

interface PageProps {
  params: { name: string }
}

export default function MemberDetailPage({ params }: PageProps) {
  const member = getMemberDetail(params.name)
  if (!member) notFound()

  const tabs = [
    {
      id: 'profile',
      label: 'プロフィール',
      content: <ProfileTab member={member} />,
    },
    {
      id: 'goals',
      label: '目標（2026上期）',
      content: <GoalsTab goals={member.goals} />,
    },
    {
      id: 'one-on-one',
      label: `1on1記録 (${member.oneOnOnes.length})`,
      content: <OneOnOneTab oneOnOnes={member.oneOnOnes} />,
    },
  ]

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-7">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-7 text-sm">
            <Link href="/" className="text-indigo-600 hover:text-indigo-800 transition-colors font-medium">
              ← ダッシュボード
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-700 font-semibold">{member.name}</span>
          </div>

          {/* Tabs */}
          <Tabs tabs={tabs} defaultTab="profile" />
        </div>
      </div>

      {/* Chat sidebar — wider for readability */}
      <div className="w-96 border-l border-gray-200 bg-white flex flex-col">
        <ChatSidebar
          memberName={member.name}
          memberContext={member.rawMarkdown}
        />
      </div>
    </div>
  )
}
