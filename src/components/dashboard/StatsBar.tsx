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

  const stats = [
    { label: 'メンバー数', value: `${members.length}名`, accent: false },
    { label: '実案件稼働率', value: `${actualRate}%`, accent: false },
    { label: 'R&D稼働率', value: `${rdRate}%`, accent: true },
    { label: 'Flutter', value: `${flutter}名`, accent: false },
    { label: 'KMP', value: `${kmp}名`, accent: false },
    { label: 'Producer', value: `${producer}名`, accent: false },
  ]

  return (
    <div className="grid grid-cols-6 gap-5 mb-8">
      {stats.map(stat => (
        <div key={stat.label} className={`rounded-2xl border p-7 text-center shadow-sm ${
          stat.accent
            ? 'bg-indigo-600 border-indigo-600 text-white'
            : 'bg-white border-gray-200 text-gray-900'
        }`}>
          <div className={`text-7xl font-bold leading-none ${stat.accent ? 'text-white' : 'text-gray-900'}`}>
            {stat.value}
          </div>
          <div className={`text-2xl mt-3 ${stat.accent ? 'text-indigo-200' : 'text-gray-500'}`}>
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  )
}
