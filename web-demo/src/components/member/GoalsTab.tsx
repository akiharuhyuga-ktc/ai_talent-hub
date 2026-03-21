'use client'

import { useState } from 'react'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatPeriodLabel, sortPeriods } from '@/lib/utils/period'
import type { GoalsData } from '@/lib/types'

interface GoalsTabProps {
  goalsByPeriod: Record<string, GoalsData>
  activePeriod: string
  onStartWizard?: (period: string) => void
}

export function GoalsTab({ goalsByPeriod, activePeriod, onStartWizard }: GoalsTabProps) {
  const periods = Object.keys(goalsByPeriod)
  // Compute next period after active (e.g., 2025-h2 → 2026-h1)
  const activeMatch = activePeriod.match(/^(\d{4})-(h[12])$/)
  const nextPeriod = activeMatch
    ? activeMatch[2] === 'h1' ? `${activeMatch[1]}-h2` : `${parseInt(activeMatch[1]) + 1}-h1`
    : null
  // Ensure activePeriod and nextPeriod are always in the list
  const periodSet = new Set(periods)
  periodSet.add(activePeriod)
  if (nextPeriod) periodSet.add(nextPeriod)
  const allPeriods = sortPeriods(Array.from(periodSet))

  const [selectedPeriod, setSelectedPeriod] = useState(activePeriod)
  const goals = goalsByPeriod[selectedPeriod] ?? null

  const isEmpty = !goals || (!goals.rawMarkdown.includes('目標内容') && !goals.rawMarkdown.includes('目標①'))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h3 className="text-3xl font-semibold text-gray-800">半期目標</h3>
          {allPeriods.length > 1 ? (
            <select
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
              className="text-xl border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {allPeriods.map(p => {
                const hasGoal = !!goalsByPeriod[p]
                const isActive = p === activePeriod
                const suffix = isActive && !hasGoal ? '（アクティブ・未設定）' : isActive ? '（アクティブ）' : !hasGoal ? '（未設定）' : ''
                return (
                  <option key={p} value={p}>
                    {formatPeriodLabel(p)}{suffix}
                  </option>
                )
              })}
            </select>
          ) : (
            <span className="text-2xl text-gray-500">{formatPeriodLabel(selectedPeriod)}</span>
          )}
          {selectedPeriod === activePeriod && (
            <span className="text-lg bg-green-100 text-green-700 px-3 py-1 rounded-full border border-green-200 font-medium">
              アクティブ
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isEmpty && (
            <span className="text-xl bg-amber-50 text-amber-600 px-5 py-2 rounded-full border border-amber-200 font-medium">
              未記入
            </span>
          )}
          {onStartWizard && (
            <button
              onClick={() => onStartWizard(selectedPeriod)}
              className="text-lg bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            >
              目標設定ウィザード
            </button>
          )}
        </div>
      </div>
      {goals ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10">
          <MarkdownRenderer content={goals.rawMarkdown} />
        </div>
      ) : (
        <EmptyState
          title="この期間の目標はまだ設定されていません"
          description="ウィザードから目標を作成できます"
          icon="🎯"
        />
      )}
    </div>
  )
}
