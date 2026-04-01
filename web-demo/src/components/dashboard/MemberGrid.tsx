'use client'

import { useState } from 'react'
import { MemberCard } from './MemberCard'
import { clsx } from 'clsx'
import type { MemberSummary } from '@/lib/types'

interface MemberGridProps {
  members: MemberSummary[]
}

const FILTERS = ['全員', 'Flutter', 'KMP', 'Producer', 'その他'] as const
type Filter = typeof FILTERS[number]

export function MemberGrid({ members }: MemberGridProps) {
  const [filter, setFilter] = useState<Filter>('全員')

  const filtered = filter === '全員'
    ? members
    : members.filter(m => m.teamShort === filter)

  const counts: Record<Filter, number> = {
    '全員': members.length,
    'Flutter': members.filter(m => m.teamShort === 'Flutter').length,
    'KMP': members.filter(m => m.teamShort === 'KMP').length,
    'Producer': members.filter(m => m.teamShort === 'Producer').length,
    'その他': members.filter(m => m.teamShort === 'その他').length,
  }

  return (
    <div>
      {/* Filter pills */}
      <div className="flex gap-3 flex-wrap mb-8">
        {FILTERS.map(f => {
          if (counts[f] === 0 && f !== '全員') return null
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'px-7 py-3 rounded-full text-2xl font-medium transition-colors',
                filter === f
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
              )}
            >
              {f} ({counts[f]})
            </button>
          )
        })}
      </div>

      {/* Card grid — 2 columns max to fit larger text */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filtered.map(member => (
          <MemberCard key={member.name} member={member} />
        ))}
      </div>
    </div>
  )
}
