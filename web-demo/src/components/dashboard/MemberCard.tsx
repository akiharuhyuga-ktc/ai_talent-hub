import Link from 'next/link'
import { Badge, teamBadgeVariant } from '@/components/ui/Badge'
import type { MemberSummary } from '@/lib/types'

const teamGradients: Record<string, string> = {
  Flutter: 'from-brand-600 to-brand-800',
  KMP: 'from-emerald-500 to-emerald-700',
  Producer: 'from-amber-500 to-amber-700',
}

interface MemberCardProps {
  member: MemberSummary
}

export function MemberCard({ member }: MemberCardProps) {
  const teamVariant = teamBadgeVariant(member.teamShort)
  const rdProject = member.projects.find(p =>
    p.name.includes('R＆D') || p.name.includes('R&D')
  )
  const gradient = teamGradients[member.teamShort] || 'from-gray-500 to-gray-700'

  return (
    <div className="bg-white rounded-radius-xl shadow-card p-6 flex gap-5 items-start hover:shadow-card-hover transition-shadow cursor-pointer">
      {/* Avatar */}
      <div className={`w-12 h-12 rounded-radius-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
        <span className="text-white text-xl font-bold">{member.name.slice(0, 1)}</span>
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        {/* Name + badges */}
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h3 className="text-2xl font-semibold text-gray-900">{member.name}</h3>
          <Badge label={member.teamShort} variant={teamVariant} />
          {rdProject && (
            <Badge label={`R&D ${rdProject.avgPct}%`} variant="purple" />
          )}
        </div>
        <p className="text-xl text-gray-500 mb-3">{member.role}</p>

        {/* Project bars */}
        {member.projects.length > 0 && (
          <div className="space-y-2">
            <p className="text-lg font-semibold text-gray-400 uppercase tracking-wide">プロジェクト配分</p>
            {member.projects.map(proj => (
              <div key={proj.name}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xl text-gray-600 truncate max-w-[70%]">{proj.name}</span>
                  <span className="text-xl font-semibold text-gray-800 ml-2 tabular-nums">{proj.avgPct}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-gradient-to-r from-brand-300 to-brand-600 h-1.5 rounded-full transition-all"
                    style={{ width: `${proj.avgPct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Link */}
        <Link
          href={`/members/${encodeURIComponent(member.folderName)}`}
          className="mt-3 inline-flex items-center text-xl text-brand-600 font-medium hover:text-brand-800 transition-colors"
        >
          詳細を見る →
        </Link>
      </div>
    </div>
  )
}
