import { notFound } from 'next/navigation'
import { getMemberDetail } from '@/lib/fs/members'
import { loadSharedDocs } from '@/lib/fs/shared-docs'
import { MemberDetailClient } from '@/components/member/MemberDetailClient'

interface PageProps {
  params: { name: string }
}

export default function MemberDetailPage({ params }: PageProps) {
  const member = getMemberDetail(params.name)
  if (!member) notFound()

  const shared = loadSharedDocs()

  const wizardContext = {
    memberName: member.name,
    memberProfile: member.rawMarkdown,
    departmentPolicy: shared.policy,
    evaluationCriteria: shared.criteria,
    guidelines: shared.guidelines,
  }

  return <MemberDetailClient member={member} wizardContext={wizardContext} />
}
