import Link from 'next/link'
import { Badge, teamBadgeVariant } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import type { MemberSummary } from '@/lib/types'

interface MemberCardProps {
  member: MemberSummary
}

export function MemberCard({ member }: MemberCardProps) {
  const teamVariant = teamBadgeVariant(member.teamShort)
  const rdProject = member.projects.find(p =>
    p.name.includes('R＆D') || p.name.includes('R&D')
  )

  return (
    <Card hoverable className="p-8 flex flex-col gap-5">
      {/* Header badges */}
      <div className="flex gap-3 flex-wrap">
        <Badge label={member.teamShort} variant={teamVariant} />
        {rdProject && (
          <Badge label={`R&D ${rdProject.avgPct}%`} variant="purple" />
        )}
      </div>

      {/* Name & role */}
      <div>
        <h3 className="text-4xl font-bold text-gray-900 leading-tight">{member.name}</h3>
        <p className="text-2xl text-gray-500 mt-2 leading-snug">{member.role}</p>
        <p className="text-xl text-gray-400 mt-2">入社：{member.joinedAt}</p>
      </div>

      {/* Project allocation bars */}
      {member.projects.length > 0 && (
        <div className="space-y-4">
          <p className="text-lg font-semibold text-gray-400 uppercase tracking-wide">プロジェクト配分</p>
          {member.projects.map(proj => (
            <div key={proj.name}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-2xl text-gray-700 truncate max-w-[70%]">{proj.name}</span>
                <span className="text-2xl font-bold text-gray-800 ml-2 tabular-nums">{proj.avgPct}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div
                  className="bg-indigo-500 h-3 rounded-full transition-all"
                  style={{ width: `${proj.avgPct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link */}
      <Link
        href={`/members/${encodeURIComponent(member.name)}`}
        className="mt-auto inline-flex items-center text-2xl text-indigo-600 font-semibold hover:text-indigo-800 transition-colors"
      >
        詳細を見る
        <svg className="ml-2 w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </Card>
  )
}
