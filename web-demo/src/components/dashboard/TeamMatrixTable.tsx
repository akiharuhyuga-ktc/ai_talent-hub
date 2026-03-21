'use client'

import Link from 'next/link'
import { MatrixCell } from './MatrixCell'
import type { MemberPeriodStatus } from '@/lib/types'

interface TeamMatrixTableProps {
  members: MemberPeriodStatus[]
  period: string
  today: string
}

const MONTH_KEYS_H1 = ['04', '05', '06', '07', '08', '09']
const MONTH_KEYS_H2 = ['10', '11', '12', '01', '02', '03']
const MONTH_LABELS_H1 = ['4月', '5月', '6月', '7月', '8月', '9月']
const MONTH_LABELS_H2 = ['10月', '11月', '12月', '1月', '2月', '3月']

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
  const todayMonth = today.slice(0, 7) // YYYY-MM
  return calendarMonth > todayMonth
}

function getArrivedMonths(monthKeys: string[], period: string, today: string): string[] {
  return monthKeys.filter(mk => !isFutureMonth(mk, period, today))
}

function getCompletionRate(
  member: MemberPeriodStatus,
  arrivedMonths: string[]
): { completed: number; total: number } {
  const total = arrivedMonths.length
  const completed = arrivedMonths.filter(mk => member.oneOnOneMonths.includes(mk)).length
  return { completed, total }
}

export function TeamMatrixTable({ members, period, today }: TeamMatrixTableProps) {
  const half = period.split('-')[1] as 'h1' | 'h2'
  const monthKeys = half === 'h1' ? MONTH_KEYS_H1 : MONTH_KEYS_H2
  const monthLabels = half === 'h1' ? MONTH_LABELS_H1 : MONTH_LABELS_H2
  const arrivedMonths = getArrivedMonths(monthKeys, period, today)

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className="sticky left-0 z-20 bg-gray-50 px-5 py-3 text-left text-lg font-semibold text-gray-700 border-r border-gray-200 whitespace-nowrap">
              メンバー
            </th>
            <th className="px-4 py-3 text-center text-lg font-semibold text-gray-700 border-r border-gray-200 whitespace-nowrap">
              目標
            </th>
            {monthLabels.map((label, i) => (
              <th
                key={monthKeys[i]}
                className="px-4 py-3 text-center text-lg font-semibold text-gray-700 border-r border-gray-200 whitespace-nowrap"
              >
                {label}
              </th>
            ))}
            <th className="px-4 py-3 text-center text-lg font-semibold text-gray-700 border-r border-gray-200 whitespace-nowrap">
              評価
            </th>
            <th className="px-4 py-3 text-center text-lg font-semibold text-gray-700 whitespace-nowrap">
              充足率
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {members.map(member => {
            const { completed, total } = getCompletionRate(member, arrivedMonths)
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0
            return (
              <tr key={member.memberName} className="hover:bg-indigo-50/40 transition-colors">
                <td className="sticky left-0 z-10 bg-white hover:bg-indigo-50/40 px-5 py-3 border-r border-gray-200">
                  <Link
                    href={`/members/${encodeURIComponent(member.memberName)}`}
                    className="text-lg text-indigo-600 hover:text-indigo-800 font-medium hover:underline whitespace-nowrap"
                  >
                    {member.memberName}
                  </Link>
                  <span className="ml-2 text-base text-gray-400">{member.team}</span>
                </td>
                <td className="px-4 py-3 border-r border-gray-200">
                  <MatrixCell variant={member.hasGoal ? 'ok' : 'ng'} />
                </td>
                {monthKeys.map(mk => {
                  const future = isFutureMonth(mk, period, today)
                  const done = member.oneOnOneMonths.includes(mk)
                  const variant = future ? 'future' : done ? 'ok' : 'ng'
                  return (
                    <td key={mk} className="px-4 py-3 border-r border-gray-200">
                      <MatrixCell variant={variant} />
                    </td>
                  )
                })}
                <td className="px-4 py-3 border-r border-gray-200">
                  <MatrixCell variant={member.hasReview ? 'ok' : 'ng'} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-center min-w-[100px]">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-[60px]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: pct === 100 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444',
                        }}
                      />
                    </div>
                    <span className="text-lg text-gray-600 whitespace-nowrap">
                      {completed}/{total}
                    </span>
                  </div>
                </td>
              </tr>
            )
          })}
          {members.length === 0 && (
            <tr>
              <td colSpan={monthKeys.length + 4} className="px-5 py-10 text-center text-lg text-gray-400">
                該当するメンバーがいません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
