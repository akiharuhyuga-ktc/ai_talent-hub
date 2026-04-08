import { Users, Briefcase, FlaskConical } from 'lucide-react'
import type { MemberSummary } from '@/lib/types'

interface StatsBarProps {
  members: MemberSummary[]
}

export function StatsBar({ members }: StatsBarProps) {
  const flutter = members.filter(m => m.teamShort === 'Flutter').length
  const kmp = members.filter(m => m.teamShort === 'KMP').length
  const producer = members.filter(m => m.teamShort === 'Producer').length
  const totalRd = members.reduce((sum, m) => sum + m.rdPct, 0)
  const totalAll = members.reduce((sum, m) => sum + m.projects.reduce((s, p) => s + p.avgPct, 0), 0)
  const rdRate = totalAll > 0 ? Math.round((totalRd / totalAll) * 100) : 0
  const actualRate = totalAll > 0 ? Math.round(((totalAll - totalRd) / totalAll) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Large metric cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Members */}
        <div className="rounded-radius-xl p-6 bg-white shadow-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl font-medium text-gray-400">メンバー数</span>
            <Users size={20} className="text-brand-200" />
          </div>
          <div className="text-[44px] font-bold text-gray-900 leading-none tracking-tight">{members.length}</div>
          <div className="text-xl text-gray-400 mt-1">名</div>
        </div>

        {/* Actual rate */}
        <div className="rounded-radius-xl p-6 bg-white shadow-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl font-medium text-gray-400">実案件稼働率</span>
            <Briefcase size={20} className="text-brand-200" />
          </div>
          <div className="text-[44px] font-bold text-gray-900 leading-none tracking-tight">{actualRate}</div>
          <div className="text-xl text-gray-400 mt-1">%</div>
        </div>

        {/* R&D rate (accent) */}
        <div className="rounded-radius-xl p-6 bg-gradient-to-br from-brand-600 to-brand-800 shadow-glow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl font-medium text-brand-200">R&D稼働率</span>
            <FlaskConical size={20} className="text-brand-300" />
          </div>
          <div className="text-[44px] font-bold text-white leading-none tracking-tight">{rdRate}</div>
          <div className="text-xl text-brand-200 mt-1">%</div>
        </div>
      </div>

      {/* Team mini cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-radius-xl px-5 py-4 bg-white shadow-card flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-600" />
          <span className="text-2xl font-medium text-gray-600">Flutter</span>
          <span className="text-3xl font-bold text-gray-900 ml-auto">{flutter}</span>
        </div>
        <div className="rounded-radius-xl px-5 py-4 bg-white shadow-card flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-2xl font-medium text-gray-600">KMP</span>
          <span className="text-3xl font-bold text-gray-900 ml-auto">{kmp}</span>
        </div>
        <div className="rounded-radius-xl px-5 py-4 bg-white shadow-card flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-2xl font-medium text-gray-600">Producer</span>
          <span className="text-3xl font-bold text-gray-900 ml-auto">{producer}</span>
        </div>
      </div>
    </div>
  )
}
