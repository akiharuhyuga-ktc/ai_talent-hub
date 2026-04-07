'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { clsx } from 'clsx'
import { formatPeriodLabel } from '@/lib/utils/period'
import { TeamMatrixTable } from './TeamMatrixTable'
import type { MemberPeriodStatus, TeamPeriodMatrix } from '@/lib/types'

interface TeamMatrixViewProps {
  activePeriod: string
  today: string
}

const TEAM_FILTERS = ['全員', 'Flutter', 'KMP', 'Producer', 'その他'] as const
type TeamFilter = typeof TEAM_FILTERS[number]

const MONTH_KEYS_H1 = ['04', '05', '06', '07', '08', '09']
const MONTH_KEYS_H2 = ['10', '11', '12', '01', '02', '03']

function isFutureMonth(monthKey: string, period: string, today: string): boolean {
  const [yearStr, half] = period.split('-') as [string, 'h1' | 'h2']
  const monthNum = parseInt(monthKey)
  let calendarYear: number
  if (half === 'h1') {
    calendarYear = parseInt(yearStr)
  } else {
    calendarYear = monthNum >= 10 ? parseInt(yearStr) : parseInt(yearStr) + 1
  }
  const calendarMonth = `${calendarYear}-${monthKey}`
  const todayMonth = today.slice(0, 7)
  return calendarMonth > todayMonth
}

export function TeamMatrixView({ activePeriod, today }: TeamMatrixViewProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(activePeriod)
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('全員')
  const [matrix, setMatrix] = useState<TeamPeriodMatrix | null>(null)
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fetchMatrix = useCallback(async (period: string) => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/team/matrix?period=${encodeURIComponent(period)}`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || data.error || 'チームマトリクスを取得できませんでした。')
      }
      setMatrix(data.matrix)
      setAvailablePeriods(data.availablePeriods || [])
    } catch (err) {
      console.error('Failed to fetch team matrix:', err)
      setMatrix(null)
      setAvailablePeriods([])
      setErrorMessage(err instanceof Error ? err.message : 'チームマトリクスを取得できませんでした。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMatrix(selectedPeriod)
  }, [selectedPeriod, fetchMatrix])

  const filteredMembers = useMemo(() => {
    if (!matrix) return []
    if (teamFilter === '全員') return matrix.members
    return matrix.members.filter(m => {
      if (teamFilter === 'その他') {
        return !['Flutter', 'KMP', 'Producer'].includes(m.team)
      }
      return m.team === teamFilter
    })
  }, [matrix, teamFilter])

  const teamCounts = useMemo(() => {
    if (!matrix) return {} as Record<TeamFilter, number>
    const all = matrix.members
    return {
      '全員': all.length,
      'Flutter': all.filter(m => m.team === 'Flutter').length,
      'KMP': all.filter(m => m.team === 'KMP').length,
      'Producer': all.filter(m => m.team === 'Producer').length,
      'その他': all.filter(m => !['Flutter', 'KMP', 'Producer'].includes(m.team)).length,
    }
  }, [matrix])

  // Summary chips
  const summary = useMemo(() => {
    const members = filteredMembers
    const goalUnset = members.filter(m => !m.hasGoal).length
    const reviewUnset = members.filter(m => !m.hasReview).length

    const half = selectedPeriod.split('-')[1] as 'h1' | 'h2'
    const monthKeys = half === 'h1' ? MONTH_KEYS_H1 : MONTH_KEYS_H2
    const arrivedMonths = monthKeys.filter(mk => !isFutureMonth(mk, selectedPeriod, today))

    const oneOnOneMissing = members.filter(m => {
      return arrivedMonths.some(mk => !m.oneOnOneMonths.includes(mk))
    }).length

    return { goalUnset, oneOnOneMissing, reviewUnset }
  }, [filteredMembers, selectedPeriod, today])

  return (
    <div>
      {/* Row 1: Period selector + team filter pills */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <select
          value={selectedPeriod}
          onChange={e => setSelectedPeriod(e.target.value)}
          className="text-xl bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        >
          {availablePeriods.map(p => (
            <option key={p} value={p}>
              {formatPeriodLabel(p)}
            </option>
          ))}
          {!availablePeriods.includes(selectedPeriod) && (
            <option value={selectedPeriod}>
              {formatPeriodLabel(selectedPeriod)}
            </option>
          )}
        </select>

        <div className="flex gap-2 flex-wrap">
          {TEAM_FILTERS.map(f => {
            const count = teamCounts[f] ?? 0
            if (count === 0 && f !== '全員') return null
            return (
              <button
                key={f}
                onClick={() => setTeamFilter(f)}
                className={clsx(
                  'px-5 py-2 rounded-full text-base font-medium transition-colors',
                  teamFilter === f
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-300 hover:text-brand-600'
                )}
              >
                {f} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Row 2: Summary chips */}
      <div className="flex flex-wrap gap-3 mb-6">
        <SummaryChip
          label="目標未設定"
          count={summary.goalUnset}
          suffix="名"
          type={summary.goalUnset > 0 ? 'danger' : 'success'}
        />
        <SummaryChip
          label="1on1未実施月あり"
          count={summary.oneOnOneMissing}
          suffix="名"
          type={summary.oneOnOneMissing > 0 ? 'danger' : 'success'}
        />
        <SummaryChip
          label="評価未実施"
          count={summary.reviewUnset}
          suffix="名"
          type={summary.reviewUnset > 0 ? 'danger' : 'success'}
        />
      </div>

      {/* Matrix table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-200 border-t-brand-600" />
          <span className="ml-3 text-lg text-gray-500">読み込み中...</span>
        </div>
      ) : errorMessage ? (
        <div className="rounded-radius-xl border border-amber-200 bg-amber-50 p-6 text-gray-800">
          <h2 className="text-xl font-semibold text-amber-900">チームマトリクスを読み込めません</h2>
          <p className="mt-3 text-sm leading-6">{errorMessage}</p>
        </div>
      ) : (
        <TeamMatrixTable members={filteredMembers} period={selectedPeriod} today={today} />
      )}
    </div>
  )
}

function SummaryChip({
  label,
  count,
  suffix,
  type,
}: {
  label: string
  count: number
  suffix: string
  type: 'danger' | 'success'
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-base font-medium border',
        type === 'danger'
          ? 'bg-red-50 text-red-700 border-red-200'
          : 'bg-green-50 text-green-700 border-green-200'
      )}
    >
      <span
        className={clsx(
          'inline-block w-2 h-2 rounded-full',
          type === 'danger' ? 'bg-red-500' : 'bg-green-500'
        )}
      />
      {label} {count}{suffix}
    </span>
  )
}
