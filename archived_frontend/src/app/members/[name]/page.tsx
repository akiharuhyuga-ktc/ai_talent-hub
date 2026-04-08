import { notFound } from 'next/navigation'
import { getMemberDetail } from '@/lib/fs/members'
import { loadSharedDocs } from '@/lib/fs/shared-docs'
import { MemberDetailClient } from '@/components/member/MemberDetailClient'
import { parseActionItems, parseConditionScore, parseSummary } from '@/lib/parsers/one-on-one'

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
    orgPolicy: shared.policy,
    evaluationCriteria: shared.criteria,
    guidelines: shared.guidelines,
    targetPeriod: member.activePeriod,  // MemberDetailClientで選択期間に上書きされる
  }

  // 1on1 context
  const latestOneOnOne = member.oneOnOnes.length > 0 ? member.oneOnOnes[0] : null
  const oneOnOneContext = {
    memberName: member.name,
    memberProfile: member.rawMarkdown,
    orgPolicy: shared.policy,
    guidelines: shared.guidelines,
    goalsRawMarkdown: member.goals?.rawMarkdown || null,
    previousOneOnOne: latestOneOnOne,
    previousActionItems: latestOneOnOne ? parseActionItems(latestOneOnOne.rawMarkdown) : [],
    previousCondition: latestOneOnOne ? parseConditionScore(latestOneOnOne.rawMarkdown) : null,
    previousSummary: latestOneOnOne ? parseSummary(latestOneOnOne.rawMarkdown) : '',
  }

  // Evaluation context
  const latestReview = member.reviews.length > 0 ? member.reviews[0] : null
  const evaluationContext = {
    memberName: member.name,
    memberProfile: member.rawMarkdown,
    orgPolicy: shared.policy,
    evaluationCriteria: shared.criteria,
    guidelines: shared.guidelines,
    goalsRawMarkdown: member.goals?.rawMarkdown || null,
    oneOnOneRecords: member.oneOnOnes,
    previousReview: latestReview,
  }

  return (
    <MemberDetailClient
      member={member}
      wizardContext={wizardContext}
      oneOnOneContext={oneOnOneContext}
      evaluationContext={evaluationContext}
    />
  )
}
